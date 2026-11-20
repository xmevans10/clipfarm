"""HTTP adapter for the Cloudflare rendering container."""
import json
import re
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from pipeline import EngineAPI, InvalidSource, StageError, process

render_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.send_json(200 if self.path == "/health" else 404, {"status":"ready"})

    def job_body(self):
        limit = 8192
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            data = bytearray()
            while True:
                line = self.rfile.readline(128)
                if not line.endswith(b"\r\n"):
                    raise ValueError("Invalid chunk header")
                size = int(line.split(b";", 1)[0], 16)
                if size < 0 or len(data) + size > limit:
                    raise ValueError("Job too large")
                if not size:
                    return bytes(data)
                data.extend(self.rfile.read(size))
                if self.rfile.read(2) != b"\r\n":
                    raise ValueError("Invalid chunk boundary")
        length = int(self.headers.get("Content-Length", 0))
        if not 0 < length <= limit:
            raise ValueError("Missing or oversized job")
        return self.rfile.read(length)

    def do_POST(self):
        if self.path != "/render":
            self.send_json(404, {"error":"Unknown endpoint."})
            return
        if not render_lock.acquire(blocking=False):
            self.send_json(503, {"error":"Renderer busy."})
            return
        try:
            try:
                job = json.loads(self.job_body())
            except (ValueError, UnicodeError):
                self.send_json(400, {"error":"Invalid job.", "stage":"read_job"})
                return
            count = job["count"]
            callback = urlsplit(job["callback"])
            if type(count) is not int or not 1 <= count <= 10 or not re.fullmatch(r"[0-9a-f-]{36}", job["token"]):
                self.send_json(422, {"error":"Invalid job."})
                return
            if callback.scheme != "http" or callback.netloc != "clipfarm.internal":
                self.send_json(422, {"error":"Invalid callback."})
                return
            with tempfile.TemporaryDirectory(prefix="clipfarm-") as directory:
                clips = process(job["source"], count, Path(directory), EngineAPI(job["callback"], job["token"]))
            self.send_json(200, {"clips":clips})
        except InvalidSource as exc:
            self.send_json(422, {"error":str(exc)})
        except StageError as exc:
            self.send_json(502, {"error":"Processing failed.", "stage":str(exc)})
        except Exception as exc:
            print(json.dumps({"event":"render_error","type":type(exc).__name__}), flush=True)
            self.send_json(502, {"error":"Processing failed.", "stage":type(exc).__name__})
        finally:
            render_lock.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0",8080),Handler).serve_forever()
