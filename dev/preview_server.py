#!/usr/bin/env python3
"""知潮本地预览：stub /api/session（已登录）与 /api/memory，静态直读 cloud/。
用法：python3 dev/preview_server.py [port]（默认 8811）/tmp 会被清空，所以放在仓库里。"""
import json, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cloud")
MEM_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".preview-memory.json")


def load_mem():
    if os.path.exists(MEM_FILE):
        try:
            return json.load(open(MEM_FILE, encoding="utf-8"))
        except Exception:
            pass
    return {"version": 2, "longTerm": [], "threads": {}, "visits": [], "updatedAt": None}


class H(SimpleHTTPRequestHandler):
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

    def do_GET(self):
        if self.path.startswith("/api/session"):
            return self._json({"authenticated": True, "user": {"name": "preview"}})
        if self.path.startswith("/api/memory"):
            return self._json({"memory": load_mem()})
        return super().do_GET()

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            body = json.loads(raw or b"{}")
        except Exception:
            body = {}
        if self.path.startswith("/api/memory"):
            mem = load_mem()
            if body.get("visitsOnly"):
                mem["visits"] = body.get("visits", mem.get("visits", []))
            else:
                mem.update({k: v for k, v in body.items() if k != "visitsOnly"})
            json.dump(mem, open(MEM_FILE, "w", encoding="utf-8"), ensure_ascii=False)
            return self._json({"ok": True})
        return self._json({"ok": True})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8811
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
