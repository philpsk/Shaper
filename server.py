"""
V82 CORS Proxy & Static File Server
포트 8000: 정적 파일 + /api/rankinfo 프록시
"""
import http.server
import urllib.request
import urllib.parse
import ssl
import json
import os

STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
GAME_BASE = "http://www.chaosonline.co.kr:8081/ClientJson/RecordInfo.aspx"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def log_message(self, format, *args):
        pass  # 조용하게

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/rankinfo":
            self.proxy_rankinfo(parsed.query)
        else:
            super().do_GET()

    def proxy_rankinfo(self, query):
        try:
            url = f"{GAME_BASE}?{query}"
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "*/*",
                "Referer": "http://www.chaosonline.co.kr/"
            })
            with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
                data = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            err = json.dumps({"error": str(e)}).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)

if __name__ == "__main__":
    port = 8088
    print(f"[V82 Server] http://localhost:{port}  (CORS proxy + static)")
    server = http.server.HTTPServer(("", port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[V82 Server] 종료됨")
