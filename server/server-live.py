#!/usr/bin/env python3
# 知潮后端服务（仅标准库，无外部依赖）
# 职责：
#   1. 访问口令认证：/login /logout /session /auth（供 nginx auth_request 子请求调用）
#   2. 聊天记忆 JSON 存储：/memory
#   3. 看板娘聊天代理：/chat —— 注入站内数据库上下文，转发 Moonshot 并 SSE 透传
# 安全要点：
#   - 口令只以「盐 + 口令」的 SHA-256 哈希形式存在于服务器配置，前端永远拿不到盐与哈希
#   - 登录成功下发 HMAC 签名的无状态会话 Cookie，HttpOnly，JS 不可读、不可伪造
#   - 所有比对使用 hmac.compare_digest 常量时间比较，防时序侧信道
#   - 按来源 IP 记录失败次数，超限临时锁定，防在线暴力破解
#   - Moonshot 密钥仅存在于本服务环境变量，不进静态目录、不暴露给前端
import base64
import hashlib
import hmac
import json
import os
import secrets
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---------------- 配置（全部来自环境变量） ----------------
BASE = os.environ.get("MEMORY_DIR", "/data")
TOKEN = os.environ.get("MEMORY_TOKEN", "")
ACCESS_SALT = os.environ.get("ACCESS_SALT", "")
ACCESS_HASH = os.environ.get("ACCESS_HASH", "").strip().lower()
SESSION_SECRET = os.environ.get("SESSION_SECRET", "").encode("utf-8")
SESSION_TTL = int(os.environ.get("SESSION_TTL", str(7 * 24 * 3600)))  # 会话有效期，默认 7 天
COOKIE_NAME = "zhichao_session"
MAX_CODE_LEN = 256          # 口令最大长度
MAX_BODY = 4 * 1024        # 登录请求体上限
MAX_MEM_BYTES = 4 * 1024 * 1024
MEMORY_FILE = os.path.join(BASE, "chat-memory.json")
# 更新日志：权威副本放在可写的 /data（容器内 /site 是只读挂载），读取时回落到站点静态文件
CHANGELOG_FILE = os.environ.get("CHANGELOG_FILE", os.path.join(BASE, "changelog.json"))
CHANGELOG_FALLBACK = os.environ.get("CHANGELOG_FALLBACK", "/site/data/changelog.json")
MAX_CHANGELOG_BYTES = 512 * 1024

# 立绘集（用户随时上传）：图片存可写卷 /data/art/，清单 /data/gallery.json。
# 容器对 /site 只读，写不了静态目录，故图片由后端 /api/art/file/ 经鉴权回吐。
ART_DIR = os.path.join(BASE, "art")
GALLERY_FILE = os.environ.get("GALLERY_FILE", os.path.join(BASE, "gallery.json"))
MAX_ART_BYTES = 6 * 1024 * 1024        # 单图解码后上限
MAX_ART_PAYLOAD = 14 * 1024 * 1024    # 上传 JSON 体上限（含 base64，约 6MB 图）
ART_MIME = {"image/webp": "webp", "image/png": "png",
            "image/jpeg": "jpg", "image/jpg": "jpg"}

# 聊天代理配置
MOONSHOT_KEY = os.environ.get("MOONSHOT_KEY", "")
MOONSHOT_URL = os.environ.get("MOONSHOT_URL", "https://api.moonshot.cn/v1/chat/completions")
SITE_FILE = os.environ.get("SITE_FILE", "/site/data/current.json")
MAX_CHAT_BYTES = 8 * 1024 * 1024   # 聊天请求体上限
SITE_CTX_BUDGET = 12000            # 注入站内数据的字符预算，防条目膨胀
UPSTREAM_TIMEOUT = 300

# 登录失败限流：ip -> {"fails": int, "locked_until": float}
LOCK_THRESHOLD = 5         # 连续失败 5 次
LOCK_SECONDS = 300         # 锁定 5 分钟
_fail_lock = {}
# 服务端会话表：sid -> 过期时间戳。支持 logout 即时吊销，容器重启后旧 Cookie 自然失效。
_sessions = {}
_state_lock = threading.Lock()

# 会话落盘：容器重启后旧 Cookie 仍可用（签名 + 到期时间仍在校验），登出则进撤销表
SESS_FILE = os.path.join(BASE, "sessions.json")
_revoked = set()

FORM_IDS = ("mature", "loli", "cute", "group")
MAX_VISITS = 400            # 星月手账：最多保留 400 天的到访脚印
EMPTY_MEMORY = {"version": 2, "longTerm": "", "threads": {f: [] for f in FORM_IDS},
                "visits": [], "updatedAt": ""}


def _now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z"


def normalize_visits(raw):
    """星月手账的到访脚印，按日期去重合并：
    f=当天首次到访（取最早）、l=最近一次来访（取最晚）、c=首次打卡（取第一次）。
    只接受 YYYY-MM-DD 与 HH:MM，非法项丢弃，最多保留最近 MAX_VISITS 天。"""
    out = {}
    if isinstance(raw, list):
        for it in raw:
            if not isinstance(it, dict):
                continue
            d = it.get("d")
            if not isinstance(d, str) or len(d) != 10 or d[4] != "-" or d[7] != "-":
                continue
            if not (d[:4].isdigit() and d[5:7].isdigit() and d[8:10].isdigit()):
                continue
            rec = out.get(d, {"d": d})
            for key in ("f", "l", "c"):
                t = it.get(key)
                if not isinstance(t, str) or len(t) != 5 or t[2] != ":":
                    continue
                if not (t[:2].isdigit() and t[3:5].isdigit()):
                    continue
                if int(t[:2]) > 23 or int(t[3:5]) > 59:
                    continue
                if key == "f":
                    if "f" not in rec or t < rec["f"]:
                        rec["f"] = t
                elif key == "l":
                    if "l" not in rec or t > rec["l"]:
                        rec["l"] = t
                elif "c" not in rec:
                    rec["c"] = t
            out[d] = rec
    keep = sorted(out.keys())[-MAX_VISITS:]
    return [out[k] for k in keep]


def normalize_memory(data):
    """把任意历史版本的记忆统一为 version2 分形态结构。
    旧版混合 history 按每条消息的 form 字段拆分到对应线程。"""
    if not isinstance(data, dict):
        return dict(EMPTY_MEMORY)
    out = {"version": 2,
           "longTerm": data.get("longTerm", "") if isinstance(data.get("longTerm", ""), str) else "",
           "threads": {f: [] for f in FORM_IDS},
           "visits": normalize_visits(data.get("visits")),
           "updatedAt": data.get("updatedAt", "") if isinstance(data.get("updatedAt", ""), str) else ""}
    if isinstance(data.get("threads"), dict):
        for f in FORM_IDS:
            t = data["threads"].get(f)
            if isinstance(t, list):
                out["threads"][f] = t
    elif isinstance(data.get("history"), list):
        # v1 迁移：按 form 归属，缺失或非法的归入 mature（默认形态）
        for m in data["history"]:
            f = m.get("form") if isinstance(m, dict) else None
            out["threads"][f if f in FORM_IDS else "mature"].append(m)
    return out


# ---------------- 会话 Cookie（HMAC 签名 + 服务端会话表双重校验） ----------------
def _load_sessions():
    """启动时恢复会话表与撤销名单；文件损坏一律当空处理，不影响启动"""
    try:
        with open(SESS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return
    try:
        for sid, exp in (data.get("sids") or {}).items():
            _sessions[sid] = int(exp)
        for sid in data.get("revoked") or []:
            _revoked.add(str(sid))
    except Exception:
        pass


def _save_sessions():
    """原子写入，调用处必须已持有 _state_lock"""
    try:
        tmp = SESS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"sids": _sessions, "revoked": sorted(_revoked)[-2000:]}, f)
        os.replace(tmp, SESS_FILE)
    except Exception:
        pass


def _b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _unb64url(text):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def create_session():
    """登录成功时创建会话：生成 sid 入服务端表，并签发带 sid 的签名 Cookie"""
    now = int(time.time())
    sid = secrets.token_urlsafe(24)
    exp = now + SESSION_TTL
    with _state_lock:
        _sessions[sid] = exp
        _save_sessions()
    payload = json.dumps({"iat": now, "exp": exp, "sid": sid}, separators=(",", ":")).encode("utf-8")
    token = _b64url(payload)
    sig = hmac.new(SESSION_SECRET, token.encode("ascii"), hashlib.sha256).digest()
    return token + "." + _b64url(sig)


def _parse_session(value):
    """解析并验签 Cookie，返回 payload 字典；任何不合法均返回 None"""
    if not value or "." not in value:
        return None
    token, sig = value.split(".", 1)
    try:
        expected = hmac.new(SESSION_SECRET, token.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url(expected), sig):
            return None
        payload = json.loads(_unb64url(token).decode("utf-8"))
        if int(payload["exp"]) <= int(time.time()):
            return None
        return payload
    except Exception:
        return None


def valid_session(value):
    """校验会话：签名合法且 sid 仍在服务端会话表中（未被 logout 吊销、未随容器重启）"""
    payload = _parse_session(value)
    if not payload:
        return False
    sid = payload.get("sid", "")
    if sid in _revoked:
        return False
    with _state_lock:
        exp = _sessions.get(sid)
        if exp is None:
            # 服务重启过：签名与到期时间都合法就收下，别让主人重新登录
            _sessions[sid] = int(payload["exp"])
            _save_sessions()
            return True
        if exp <= time.time():
            return False
        _sessions[sid] = int(payload["exp"])  # 刷新到期时间，与 Cookie 保持一致
    return True


def revoke_session(value):
    """logout：从服务端表移除 sid 并记入撤销表，旧 Cookie 立即失效且重启后也不复活"""
    payload = _parse_session(value)
    if payload:
        sid = payload.get("sid", "")
        with _state_lock:
            _sessions.pop(sid, None)
            if sid:
                _revoked.add(sid)
            _save_sessions()


def check_password(code):
    """服务器端口令校验：sha256(盐 + 输入) 与配置哈希常量时间比较"""
    if not ACCESS_HASH or not isinstance(code, str):
        return False
    digest = hashlib.sha256((ACCESS_SALT + code).encode("utf-8")).hexdigest()
    return hmac.compare_digest(digest, ACCESS_HASH)


# ---------------- 登录限流 ----------------
def _client_ip(handler):
    # nginx 反代时注入 X-Forwarded-For；直连时回退到 TCP 对端地址
    xff = handler.headers.get("X-Forwarded-For", "")
    return xff.split(",")[0].strip() if xff.strip() else handler.client_address[0]


def is_locked(ip):
    with _state_lock:
        rec = _fail_lock.get(ip)
        if not rec:
            return False
        locked_until = rec.get("locked_until", 0)
        if locked_until > time.time():
            return True
        if locked_until:
            # 锁定已到期：清除旧记录，开启新的计数窗口
            _fail_lock.pop(ip, None)
        return False


def record_failure(ip):
    with _state_lock:
        rec = _fail_lock.get(ip, {"fails": 0, "locked_until": 0})
        rec["fails"] += 1
        if rec["fails"] >= LOCK_THRESHOLD:
            rec["locked_until"] = time.time() + LOCK_SECONDS
            rec["fails"] = 0
        _fail_lock[ip] = rec


def clear_failures(ip):
    with _state_lock:
        _fail_lock.pop(ip, None)


# ---------------- 更新日志（重要标记） ----------------
_changelog_lock = threading.Lock()
_gallery_lock = threading.Lock()


def read_changelog():
    """优先读 /data 的权威副本；缺失或损坏时回落到站点里随部署同步的那份。"""
    for path in (CHANGELOG_FILE, CHANGELOG_FALLBACK):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("entries"), list):
                return data
        except Exception:
            continue
    return {"schema": "zhichao.changelog/v1", "updatedAt": "", "entries": []}


def write_changelog(data):
    os.makedirs(BASE, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=BASE, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, CHANGELOG_FILE)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


# ---------------- 聊天记忆存储 ----------------
def read_memory():
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return normalize_memory(data)
    except Exception:
        return dict(EMPTY_MEMORY)


def write_memory(data):
    os.makedirs(BASE, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=BASE, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, MEMORY_FILE)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


# ---------------- 立绘集存储（用户上传） ----------------
def read_gallery():
    try:
        with open(GALLERY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return data
    except Exception:
        pass
    return {"schema": "zhichao.gallery/v1", "updatedAt": "", "items": []}


def write_gallery(data):
    os.makedirs(BASE, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=BASE, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, GALLERY_FILE)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def _decode_data_url(raw):
    """data:image/webp;base64,xxxx -> (mime, bytes)；非法或超限返回 (None, None)。"""
    if not isinstance(raw, str) or not raw.startswith("data:"):
        return None, None
    head, _, b64 = raw.partition(",")
    if ";" not in head or not b64:
        return None, None
    mime = head[5:head.index(";")].strip().lower()
    if mime not in ART_MIME:
        return None, None
    try:
        data = base64.b64decode(b64, validate=True)
    except Exception:
        return None, None
    if not data or len(data) > MAX_ART_BYTES:
        return None, None
    return mime, data


# ---------------- 站内数据库上下文注入 ----------------
def build_site_context():
    """读取挂载的 current.json，构造精简的全量条目清单，作为看板娘的事实依据。
    每条只保留方向/日期/标题/摘要/评分，控制 token；超预算时按评分截断。"""
    try:
        with open(SITE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return ""   # 数据文件不可用时不阻断聊天，只是不注入
    items = data.get("items", [])
    if not items:
        return ""
    try:
        ordered = sorted(items, key=lambda x: int(x.get("score", 0)), reverse=True)
    except Exception:
        ordered = items
    lines = []
    for it in ordered:
        lines.append("· [{dm} {dt}] {tl}：{sm}（评分{sc}）".format(
            dm=it.get("domain", "?"), dt=it.get("date", ""),
            tl=it.get("title", ""), sm=it.get("summary", ""), sc=it.get("score", "?")))
    # 预算保护：从高分条目开始保留，超出部分丢弃
    picked, total = [], 0
    for line in lines:
        if total + len(line) > SITE_CTX_BUDGET:
            continue
        picked.append(line)
        total += len(line)
    header = "【站内数据库·知潮热点清单，更新于 {gen}，共 {n} 条，下列按评分排列】".format(
        gen=data.get("generatedAt", ""), n=len(items))
    footer = ("【使用规则】你已掌握本站数据库：主人问站内有什么新闻、某条内容、按方向总结、"
              "哪条评分最高等问题时，严格以上述清单为准，可引用标题、摘要、评分与日期；"
              "清单里没有的事实不要编造，可建议主人点开条目看完整详情；"
              "回答保持口语化、简短，不要机械罗列全部条目，除非主人明确要求。")
    return header + "\n" + "\n".join(picked) + "\n" + footer


class Handler(BaseHTTPRequestHandler):
    server_version = "zhichao"

    # ---------- 响应工具 ----------
    def _send(self, code, obj=None, extra_headers=None):
        body = b"" if obj is None else json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for k, v in extra_headers:
                self.send_header(k, v)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _cookie(self):
        raw = self.headers.get("Cookie", "")
        for part in raw.split(";"):
            if "=" in part:
                k, v = part.strip().split("=", 1)
                if k == COOKIE_NAME:
                    return v
        return ""

    def _read_json(self, limit):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length <= 0 or length > limit:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return None

    def log_message(self, *a):
        pass

    # ---------- 路由 ----------
    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path in ("/health", "/healthz"):
            self._send(200, {"ok": True})
        elif path in ("/auth", "/session"):
            # /auth 供 nginx auth_request 子请求调用；/session 供前端页面加载时探测登录态
            ok = valid_session(self._cookie())
            self._send(200 if ok else 401,
                       {"ok": True} if path == "/auth" else {"authenticated": bool(ok)})
        elif path == "/changelog":
            # 与 /data/changelog.json 同一份文件：nginx 把读请求也代理到这里，避免站点静态副本分叉
            if not valid_session(self._cookie()):
                self._send(401, {"error": "unauthorized"})
            else:
                self._send(200, read_changelog())
        elif path == "/memory":
            self._send(200, read_memory())
        elif path == "/api/art":
            # 立绘集清单：已登录可读，内置六套由前端兜底，这里只回上传项
            if not valid_session(self._cookie()):
                self._send(401, {"error": "unauthorized"})
            else:
                self._send(200, read_gallery())
        elif path.startswith("/api/art/file/"):
            self._serve_art_file(path[len("/api/art/file/"):])
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path == "/login":
            self._handle_login()
        elif path == "/logout":
            # 服务端移除 sid（旧 Cookie 立即失效），同时让浏览器删除 Cookie
            revoke_session(self._cookie())
            self._send(200, {"ok": True},
                       [("Set-Cookie", f'{COOKIE_NAME}=""; Path=/; Max-Age=0; HttpOnly; SameSite=Lax')])
        elif path == "/changelog":
            self._handle_changelog_write()
        elif path == "/memory":
            self._handle_memory_write()
        elif path == "/chat":
            self._handle_chat()
        elif path == "/api/art":
            self._handle_art_upload()
        else:
            self._send(404, {"error": "not found"})

    def do_DELETE(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path.startswith("/api/art/"):
            self._handle_art_delete(path[len("/api/art/"):])
        else:
            self._send(404, {"error": "not found"})

    def do_PUT(self):
        # 兼容旧客户端
        if (self.path.split("?", 1)[0].rstrip("/") or "/") == "/memory":
            self._handle_memory_write()
        else:
            self._send(404, {"error": "not found"})

    # ---------- 业务处理 ----------
    def _handle_login(self):
        ip = _client_ip(self)
        if is_locked(ip):
            self._send(429, {"error": "too many attempts"})
            return
        data = self._read_json(MAX_BODY)
        code = data.get("code") if isinstance(data, dict) else None
        if not isinstance(code, str) or not code or len(code) > MAX_CODE_LEN:
            self._send(400, {"error": "bad request"})
            return
        if check_password(code):
            clear_failures(ip)
            cookie = create_session()
            self._send(200, {"ok": True},
                       [("Set-Cookie",
                         f"{COOKIE_NAME}={cookie}; Path=/; Max-Age={SESSION_TTL}; HttpOnly; SameSite=Lax")])
            return
        record_failure(ip)
        self._send(401, {"error": "invalid code"})

    def _handle_changelog_write(self):
        """一键标记某条更新为重要 / 普通。
        只允许已登录（nginx auth_request 已挡一层，这里再验一次会话）。"""
        if not valid_session(self._cookie()):
            self._send(401, {"error": "unauthorized"})
            return
        data = self._read_json(MAX_CHANGELOG_BYTES)
        if not isinstance(data, dict):
            self._send(400, {"error": "bad request"})
            return
        at = data.get("at")
        important = data.get("important")
        if not isinstance(at, str) or len(at) > 64 or not isinstance(important, bool):
            self._send(400, {"error": "bad request"})
            return
        with _changelog_lock:
            doc = read_changelog()
            hit = None
            for e in doc.get("entries", []):
                if isinstance(e, dict) and e.get("at") == at:
                    hit = e
                    break
            if hit is None:
                self._send(404, {"error": "entry not found"})
                return
            if important:
                hit["important"] = True
            else:
                hit.pop("important", None)
            write_changelog(doc)
        self._send(200, {"ok": True, "at": at, "important": important})

    def _handle_memory_write(self):
        if TOKEN and self.headers.get("X-Memory-Token", "") != TOKEN:
            self._send(403, {"error": "forbidden"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_MEM_BYTES:
            self._send(413, {"error": "bad length"})
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._send(400, {"error": "bad json"})
            return
        # 星月手账单独上云：只合并到访脚印，绝不触碰聊天线程与长期记忆
        if isinstance(data, dict) and (data.get("visitsOnly") or (
                "visits" in data and not isinstance(data.get("threads"), dict)
                and not isinstance(data.get("history"), list))):
            current = read_memory()
            current["visits"] = normalize_visits(
                current.get("visits", []) + normalize_visits(data.get("visits")))
            current["updatedAt"] = _now_iso()
            write_memory(current)
            self._send(200, {"ok": True, "visits": len(current["visits"])})
            return
        # 同时接受 version2 threads 与旧版 history，统一规范化后落盘
        if not isinstance(data, dict) or (
            not isinstance(data.get("threads"), dict) and not isinstance(data.get("history"), list)):
            self._send(400, {"error": "bad shape"})
            return
        normalized = normalize_memory(data)
        # 星月手账的到访脚印只增不减：与盘上已有记录合并，
        # 这样其它写入口（如记忆压缩、旧客户端）整体覆盖记忆时也不会抹掉脚印。
        normalized["visits"] = normalize_visits(
            read_memory().get("visits", []) + normalized["visits"])
        normalized["updatedAt"] = _now_iso()
        write_memory(normalized)
        self._send(200, {"ok": True,
                         "count": sum(len(t) for t in normalized["threads"].values())})

    # ---------------- 立绘集：上传 / 删除 / 出图 ----------------
    def _handle_art_upload(self):
        """接收 dataUrl 图片 + 元数据，落盘 /data/art/ 并登记清单。仅已登录。"""
        if not valid_session(self._cookie()):
            self._send(401, {"error": "unauthorized"})
            return
        data = self._read_json(MAX_ART_PAYLOAD)
        if not isinstance(data, dict):
            self._send(400, {"error": "bad request"})
            return
        name = (data.get("name") or "").strip()
        tag = (data.get("tag") or "").strip()
        group = (data.get("group") or "").strip()
        ds = (data.get("ds") or "").strip()
        if not name or len(name) > 40 or len(tag) > 20 or len(ds) > 300:
            self._send(400, {"error": "bad request"})
            return
        if group not in ("day", "night"):
            group = "day"
        mime, blob = _decode_data_url(data.get("dataUrl"))
        if blob is None:
            self._send(400, {"error": "unsupported or too large image"})
            return
        ext = ART_MIME[mime]
        os.makedirs(ART_DIR, exist_ok=True)
        fid = _now_iso().replace(":", "").replace("-", "").replace("T", "") + "-" + secrets.token_hex(4)
        fname = fid + "." + ext
        fpath = os.path.join(ART_DIR, fname)
        fd, tmp = tempfile.mkstemp(dir=ART_DIR, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(blob)
            os.replace(tmp, fpath)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)
        item = {
            "id": fid,
            "name": name, "tag": tag, "group": group, "ds": ds,
            "file": fname,
            "img": "/api/art/file/" + fname,
            "builtIn": False,
            "addedAt": _now_iso(),
        }
        with _gallery_lock:
            doc = read_gallery()
            doc["items"].insert(0, item)
            doc["updatedAt"] = item["addedAt"]
            write_gallery(doc)
        self._send(200, {"ok": True, "item": item})

    def _handle_art_delete(self, item_id):
        """按清单 id 删除上传项（内置六套不在清单内，不受影响）。仅已登录。"""
        if not valid_session(self._cookie()):
            self._send(401, {"error": "unauthorized"})
            return
        item_id = (item_id or "").strip()
        if not item_id or "/" in item_id or "\\" in item_id:
            self._send(400, {"error": "bad request"})
            return
        removed = None
        with _gallery_lock:
            doc = read_gallery()
            kept = []
            for it in doc.get("items", []):
                if it.get("id") == item_id and removed is None:
                    removed = it
                else:
                    kept.append(it)
            if removed is None:
                self._send(404, {"error": "not found"})
                return
            doc["items"] = kept
            doc["updatedAt"] = _now_iso()
            write_gallery(doc)
        fn = removed.get("file")
        if fn:
            try:
                os.remove(os.path.join(ART_DIR, os.path.basename(fn)))
            except Exception:
                pass
        self._send(200, {"ok": True, "id": item_id})

    def _serve_art_file(self, name):
        """按文件名回吐图片二进制，basename 防路径穿越。仅已登录。"""
        if not valid_session(self._cookie()):
            self._send(401, {"error": "unauthorized"})
            return
        name = os.path.basename(name or "")
        if not name:
            self._send(404, {"error": "not found"})
            return
        fp = os.path.join(ART_DIR, name)
        if not os.path.isfile(fp):
            self._send(404, {"error": "not found"})
            return
        ext = name.rsplit(".", 1)[-1].lower()
        mime = {"webp": "image/webp", "png": "image/png",
                "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext, "application/octet-stream")
        try:
            body = open(fp, "rb").read()
        except Exception:
            self._send(404, {"error": "not found"})
            return
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, max-age=300")
        self.end_headers()
        self.wfile.write(body)

    # ---------------- 看板娘聊天代理 ----------------
    def _handle_chat(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_CHAT_BYTES:
            self._send(413, {"error": "bad length"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._send(400, {"error": "bad json"})
            return
        if not isinstance(payload, dict) or not isinstance(payload.get("messages"), list):
            self._send(400, {"error": "bad shape"})
            return

        # 注入站内数据库上下文：置于身份 system 之后、聊天历史之前
        site_ctx = build_site_context()
        if site_ctx:
            payload["messages"].insert(1, {"role": "system", "content": site_ctx})
        upstream_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            MOONSHOT_URL, data=upstream_body, method="POST",
            headers={
                "Authorization": "Bearer " + MOONSHOT_KEY,
                "Content-Type": "application/json",
            })
        try:
            up = urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT)
        except urllib.error.HTTPError as e:
            # 上游业务错误（4xx/5xx）：状态码与响应体原样透传，前端按既有逻辑处理
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "application/json"))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                self.wfile.write(e.read())
            except Exception:
                pass
            return
        except Exception:
            self._send(502, {"error": "upstream unavailable"})
            return

        # 成功：SSE 流式透传，关闭缓冲逐块 flush
        self.send_response(up.status)
        self.send_header("Content-Type", up.headers.get("Content-Type", "text/event-stream"))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            while True:
                chunk = up.read(4096)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            return  # 客户端主动中断，正常现象
        except Exception:
            return


if __name__ == "__main__":
    # 启动即校验关键配置，缺任一秘密配置直接拒绝启动，避免裸奔
    if not ACCESS_HASH or not SESSION_SECRET or not MOONSHOT_KEY:
        raise SystemExit("FATAL: ACCESS_HASH / SESSION_SECRET / MOONSHOT_KEY 未配置，拒绝启动")
    os.makedirs(BASE, exist_ok=True)
    _load_sessions()
    if not os.path.exists(MEMORY_FILE):
        write_memory(dict(EMPTY_MEMORY))
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
