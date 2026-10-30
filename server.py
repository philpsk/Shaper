#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V82 CORS Proxy & Static File Server

  - 정적 파일 서빙
  - /api/rankinfo  →  게임 서버(RecordInfo.aspx) 프록시 (CORS 허용)

사용:
    python server.py                    # http://127.0.0.1:8088 (이 PC에서만 접속)
    python server.py --port 9000
    python server.py --host 0.0.0.0     # 같은 네트워크의 다른 기기에서도 접속 허용
    python server.py --dir ./web        # 서빙할 폴더 지정
"""
from __future__ import annotations

import argparse
import functools
import json
import os
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# ─────────────────────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────────────────────
if getattr(sys, "frozen", False):
    STATIC_DIR = os.path.dirname(sys.executable)
else:
    STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8088
GAME_BASE = "http://www.chaosonline.co.kr:8081/ClientJson/RecordInfo.aspx"
PROXY_PATH = "/api/rankinfo"
PROXY_TIMEOUT = 8                    # 초
MAX_QUERY_LEN = 2048                 # 프록시로 넘길 수 있는 쿼리스트링 최대 길이
MAX_BODY_BYTES = 5 * 1024 * 1024     # 게임 서버 응답 최대 크기

UPSTREAM_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "*/*",
    "Referer": "http://www.chaosonline.co.kr/",
}

# 정적 서빙에서 숨길 파일 (소스/설정/백업/임시/수집 원본 덤프, 점(.)으로 시작하는 파일·폴더)
# .pyw: 뷰어 소스 / .txt: DB.txt, rank_data_all_urls.txt (세션 값이 들어 있는 수집 로그)
BLOCKED_NAMES = frozenset({"settings.json"})
BLOCKED_SUFFIXES = (".py", ".pyw", ".pyc", ".bak", ".tmp", ".log", ".txt")


def _is_timeout(exc: BaseException) -> bool:
    timeouts = (socket.timeout, TimeoutError)
    return isinstance(exc, timeouts) or isinstance(getattr(exc, "reason", None), timeouts)


# ─────────────────────────────────────────────────────────────
# 핸들러
# ─────────────────────────────────────────────────────────────
class Handler(SimpleHTTPRequestHandler):
    upstream = GAME_BASE
    proxy_timeout = PROXY_TIMEOUT

    def log_message(self, format, *args):
        pass  # 접속 로그는 조용하게 (오류는 proxy 쪽에서 직접 출력)

    # ── 공통 헤더 ──
    def end_headers(self):
        # 정적 파일은 매번 재검증 → DB.json 이 갱신돼도 브라우저 캐시 때문에 옛 데이터가 보이지 않음
        # (변경 없으면 304 로 응답되므로 전송량은 그대로)
        if urllib.parse.urlparse(self.path).path != PROXY_PATH:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _send_json(self, status: int, payload, *, raw: bytes | None = None) -> None:
        body = raw if raw is not None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    # ── 정적 파일 접근 제한 ──
    @staticmethod
    def _is_blocked(path: str) -> bool:
        decoded = urllib.parse.unquote(path).replace("\\", "/")
        parts = [p.rstrip(". ").lower() for p in decoded.split("/") if p]   # Windows 의 끝 점/공백 우회 방지
        if any(p.startswith(".") for p in parts):
            return True
        if not parts:
            return False
        name = parts[-1]
        return name in BLOCKED_NAMES or name.endswith(BLOCKED_SUFFIXES)

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND, "File not found")   # 폴더 목록 노출 금지
        return None

    # ── 라우팅 ──
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == PROXY_PATH:
            self.proxy_rankinfo(parsed.query)
        elif self._is_blocked(parsed.path):
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
        else:
            super().do_GET()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == PROXY_PATH:
            self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)
        elif self._is_blocked(parsed.path):
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
        else:
            super().do_HEAD()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ── 프록시 ──
    def proxy_rankinfo(self, query: str) -> None:
        if len(query) > MAX_QUERY_LEN:
            self._send_json(HTTPStatus.REQUEST_URI_TOO_LONG, {"error": "query too long"})
            return

        url = f"{self.upstream}?{query}"
        try:
            req = urllib.request.Request(url, headers=UPSTREAM_HEADERS)
            with urllib.request.urlopen(req, timeout=self.proxy_timeout) as resp:
                data = resp.read(MAX_BODY_BYTES + 1)
            if len(data) > MAX_BODY_BYTES:
                raise ValueError("upstream response too large")
        except urllib.error.HTTPError as e:
            self._fail(HTTPStatus.BAD_GATEWAY, f"upstream HTTP {e.code}", query)
        except Exception as e:
            if _is_timeout(e):
                self._fail(HTTPStatus.GATEWAY_TIMEOUT, "upstream timeout", query)
            else:
                self._fail(HTTPStatus.BAD_GATEWAY, str(e), query)
        else:
            self._send_json(HTTPStatus.OK, None, raw=data)

    def _fail(self, status: int, message: str, query: str) -> None:
        print(f"[V82 Server] proxy 실패 ({int(status)}): {message}  | ?{query[:200]}", file=sys.stderr)
        self._send_json(status, {"error": message})


class Server(ThreadingHTTPServer):
    """요청마다 스레드를 써서, 느린 프록시 요청이 정적 파일 서빙을 막지 않게 한다."""
    daemon_threads = True

    def handle_error(self, request, client_address):
        # 브라우저가 중간에 연결을 끊는 건 정상 상황 → 트레이스백 생략
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionError, socket.timeout, TimeoutError)):
            return
        super().handle_error(request, client_address)


# ─────────────────────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────────────────────
def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="V82 CORS proxy + static file server")
    parser.add_argument("--host", default=DEFAULT_HOST,
                        help=f"바인딩 주소 (기본 {DEFAULT_HOST}; 모든 기기 허용은 0.0.0.0)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"포트 (기본 {DEFAULT_PORT})")
    parser.add_argument("--dir", default=STATIC_DIR, help="서빙할 폴더 (기본: 이 스크립트가 있는 폴더)")
    parser.add_argument("--upstream", default=GAME_BASE, help="프록시 대상 URL (테스트용)")
    parser.add_argument("--timeout", type=float, default=PROXY_TIMEOUT, help="프록시 타임아웃(초)")
    args, _ = parser.parse_known_args(argv)    # 알 수 없는 인자는 무시

    directory = os.path.abspath(args.dir)
    if not os.path.isdir(directory):
        print(f"[V82 Server] 폴더를 찾을 수 없습니다: {directory}", file=sys.stderr)
        return 1
    if not args.upstream.lower().startswith(("http://", "https://")):
        print("[V82 Server] --upstream 은 http(s):// 로 시작해야 합니다", file=sys.stderr)
        return 1

    Handler.upstream = args.upstream
    Handler.proxy_timeout = args.timeout
    handler = functools.partial(Handler, directory=directory)

    try:
        server = Server((args.host, args.port), handler)
    except OSError as e:
        print(f"[V82 Server] 포트 {args.port} 를 열 수 없습니다: {e}\n"
              f"             이미 실행 중이 아닌지 확인하거나 --port 로 다른 포트를 지정하세요.", file=sys.stderr)
        return 1

    shown_host = "localhost" if args.host in ("127.0.0.1", "") else args.host
    print(f"[V82 Server] http://{shown_host}:{args.port}  (CORS proxy + static)")
    print(f"[V82 Server] 서빙 폴더: {directory}")
    if args.host in ("0.0.0.0", "::", ""):
        print("[V82 Server] 주의: 같은 네트워크의 모든 기기에서 이 서버에 접속할 수 있습니다.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[V82 Server] 종료됨")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
