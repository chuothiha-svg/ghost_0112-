from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
import json
import os
import re
import secrets
import sqlite3
import threading
import uuid

ROOT = Path(__file__).resolve().parent
UPLOADS = ROOT / "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".ogg", ".mov"}
CHUNK_SIZE = 1024 * 1024
PRIVATE_DATA = ROOT / "private-data"
LINKS_DB = PRIVATE_DATA / "share-links.sqlite3"
LINK_BODY_LIMIT = 1024 * 1024
LINK_PATTERN = re.compile(r"[A-Za-z0-9_-]{6,12}")
DATABASE_LOCK = threading.Lock()


class SiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, value):
        payload = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def translate_path(self, path):
        request_path = urlsplit(path).path
        if request_path.startswith("/private-data/"):
            return str(ROOT / "__private_path_not_found__")
        return super().translate_path(path)

    def do_GET(self):
        request = urlsplit(self.path)
        short_match = re.fullmatch(r"/s/([A-Za-z0-9_-]{6,12})/?", request.path)
        if short_match:
            self.path = f"/share.html?id={short_match.group(1)}"
            return super().do_GET()

        api_match = re.fullmatch(r"/api/share-links/([A-Za-z0-9_-]{6,12})", request.path)
        if api_match:
            with sqlite3.connect(LINKS_DB) as connection:
                row = connection.execute(
                    "SELECT config FROM share_links WHERE code = ?",
                    (api_match.group(1),)
                ).fetchone()
            if row is None:
                self.send_json(404, {"error": "Không tìm thấy liên kết này."})
                return
            self.send_json(200, json.loads(row[0]))
            return

        return super().do_GET()

    def create_share_link(self):
        origin = self.headers.get("Origin")
        host = self.headers.get("Host")
        if origin and urlsplit(origin).netloc != host:
            self.send_json(403, {"error": "Yêu cầu tạo liên kết không cùng nguồn."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > LINK_BODY_LIMIT:
            self.send_json(413, {"error": "Cấu hình liên kết không hợp lệ."})
            return

        try:
            config = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "Không đọc được cấu hình liên kết."})
            return
        if not isinstance(config, dict):
            self.send_json(400, {"error": "Cấu hình liên kết không hợp lệ."})
            return

        for _ in range(5):
            code = secrets.token_urlsafe(5)
            try:
                with DATABASE_LOCK, sqlite3.connect(LINKS_DB) as connection:
                    connection.execute(
                        "INSERT INTO share_links (code, config) VALUES (?, ?)",
                        (code, json.dumps(config, ensure_ascii=False))
                    )
                self.send_json(201, {"code": code})
                return
            except sqlite3.IntegrityError:
                continue
        self.send_json(503, {"error": "Chưa tạo được mã ngắn, hãy thử lại."})

    def do_POST(self):
        request = urlsplit(self.path)
        if request.path == "/api/share-links":
            self.create_share_link()
            return
        if request.path != "/upload":
            self.send_json(404, {"error": "Không tìm thấy dịch vụ tải tệp."})
            return

        origin = self.headers.get("Origin")
        host = self.headers.get("Host")
        if origin and urlsplit(origin).netloc != host:
            self.send_json(403, {"error": "Yêu cầu tải tệp không cùng nguồn."})
            return

        params = parse_qs(request.query)
        original_name = Path(unquote(params.get("name", [""])[0])).name
        extension = Path(original_name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            self.send_json(415, {"error": "Định dạng tệp chưa được hỗ trợ."})
            return

        try:
            remaining = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            remaining = 0
        if remaining <= 0:
            self.send_json(400, {"error": "Tệp tải lên đang trống."})
            return

        UPLOADS.mkdir(exist_ok=True)
        stored_name = f"{uuid.uuid4().hex}{extension}"
        destination = UPLOADS / stored_name
        try:
            with destination.open("wb") as output:
                while remaining:
                    chunk = self.rfile.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        raise ConnectionError("Tệp tải lên bị ngắt giữa chừng.")
                    output.write(chunk)
                    remaining -= len(chunk)
        except (OSError, ConnectionError) as error:
            destination.unlink(missing_ok=True)
            self.send_json(507, {"error": f"Không lưu được tệp: {error}"})
            return

        self.send_json(201, {"url": f"/uploads/{stored_name}"})


if __name__ == "__main__":
    UPLOADS.mkdir(exist_ok=True)
    PRIVATE_DATA.mkdir(exist_ok=True)
    with sqlite3.connect(LINKS_DB) as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS share_links ("
            "code TEXT PRIMARY KEY, config TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), SiteHandler)
    print(f"Máy chủ đang chạy tại http://localhost:{port}/")
    print("Tệp tải lên được lưu trong thư mục uploads/; giới hạn còn tùy ổ đĩa và hosting.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
