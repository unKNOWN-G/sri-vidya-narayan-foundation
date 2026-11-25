#!/usr/bin/env python3
"""Preview the generated website on a local-only HTTP server."""
from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import re
import sys

from build import build
from validate import ROOT


class MediaPreviewHandler(SimpleHTTPRequestHandler):
    """Serve single byte ranges so native players can seek in local media."""

    def send_head(self):
        self.byte_range = None
        range_header = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not range_header or not os.path.isfile(path):
            return super().send_head()
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match or not any(match.groups()):
            self.send_error(416, "Unsupported byte range")
            return None
        file = open(path, "rb")
        size = os.fstat(file.fileno()).st_size
        first, last = match.groups()
        if first:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
        else:
            start = max(0, size - int(last))
            end = size - 1
        if start >= size or start > end:
            file.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Last-Modified", self.date_time_string(os.fstat(file.fileno()).st_mtime))
        self.end_headers()
        self.byte_range = start, end
        file.seek(start)
        return file

    def copyfile(self, source, outputfile):
        if self.byte_range is None:
            return super().copyfile(source, outputfile)
        remaining = self.byte_range[1] - self.byte_range[0] + 1
        while remaining > 0:
            block = source.read(min(64 * 1024, remaining))
            if not block:
                break
            outputfile.write(block)
            remaining -= len(block)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8876)
    parser.add_argument("--no-build", action="store_true", help="Serve the existing dist/ directory.")
    args = parser.parse_args()
    directory = ROOT / "dist"
    try:
        if not args.no_build:
            build()
        if not (directory / "index.html").is_file():
            raise ValueError("No built homepage found. Run python3 scripts/build.py first.")
        handler = partial(MediaPreviewHandler, directory=str(directory))
        server = None
        for port in range(args.port, args.port + 20):
            try:
                server = ThreadingHTTPServer(("127.0.0.1", port), handler)
                break
            except OSError as exc:
                if exc.errno not in (48, 98, 10048):
                    raise
        if server is None:
            raise ValueError("No free preview port found in the requested range.")
        print(f"Preview: http://127.0.0.1:{server.server_port}/", flush=True)
        print("Press Ctrl+C to stop. Source changes require a rebuild and browser refresh.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
    except (ValueError, OSError) as exc:
        print(f"Preview failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
