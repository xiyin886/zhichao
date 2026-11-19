#!/usr/bin/env python3
"""知潮本地预览网关（唯一一条路径，没有模式开关）。

本地与线上跑同一份 server/server-live.py，唯一差异是本机没有 nginx：
所以这里补两件事 —— 托管 cloud/ 静态文件、把 /api/* 按 nginx 的 location 表转发给后端。
不写任何业务逻辑，方法/body/Cookie/Content-Type 全部原样透传，SSE 逐块 flush。

用法：
    python dev/preview_server.py [port]      # 默认 8811
环境变量：
    ZHICHAO_BACKEND   后端地址，默认 http://127.0.0.1:8080
"""
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cloud")
BACKEND = os.environ.get("ZHICHAO_BACKEND", "http://127.0.0.1:8080")

# 复刻 nginx 的 location 映射；/api/art 在后端就是同名路径
MAP_EXACT = {
    "/api/kimi": "/chat",
    "/api/session": "/session",
    "/api/login": "/login",
    "/api/logout": "/logout",
    "/api/memory": "/memory",
    "/api/changelog": "/changelog",
}


def upstream_path(path):
    sp = urlsplit(path)
    p, q = sp.path, sp.query
    p = MAP_EXACT.get(p, p)
    return p + (("?" + q) if q else "")


class H(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.0"   # 无 Content-Length 时靠关闭连接结束，SSE 依赖这个

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy(self, method):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n) if n else None
        url = BACKEND + upstream_path(self.path)
        req = urllib.request.Request(url, data=body, method=method)
        for h in ("Content-Type", "Cookie", "Authorization"):
            v = self.headers.get(h)
            if v:
                req.add_header(h, v)
        try:
            up = urllib.request.urlopen(req, timeout=320)
        except urllib.error.HTTPError as e:
            up = e
        except Exception as e:
            return self._json(
                {"error": "backend unavailable", "detail": str(e)[:140],
                 "hint": "后端没起来：powershell -File dev/run_local.ps1"}, 502)

        self.send_response(getattr(up, "code", 200) or 200)
        for k in ("Content-Type", "Cache-Control"):
            v = up.headers.get(k) if up.headers else None
            self.send_header(k, v or ("text/event-stream" if k == "Content-Type" else "no-store"))
        for ck in (up.headers.get_all("Set-Cookie") or []) if up.headers else []:
            self.send_header("Set-Cookie", ck)
        self.end_headers()
        try:
            while True:
                chunk = up.read(4096)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy("GET")
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self._proxy("POST")
        return self._json({"error": "not found"}, 404)

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            return self._proxy("DELETE")
        return self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8811
    print("gateway : http://127.0.0.1:%d/" % port)
    print("backend : %s" % BACKEND)
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
