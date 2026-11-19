#!/usr/bin/env python3
"""Servidor de desenvolvimento do Museum App.

Serve a pasta do projeto em http://localhost:8000 e aceita o arquivo de alvos
gerado por tools/compilar-alvos.html (POST /__salvar-alvos).

    python3 tools/servidor.py [porta]
"""
import http.server
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path != '/__salvar-alvos':
            self.send_error(404)
            return
        with open(os.path.join(ROOT, 'data', 'exhibition.json'), encoding='utf-8') as f:
            target = json.load(f)['ar']['targets']
        size = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(size)
        path = os.path.join(ROOT, target)
        with open(path, 'wb') as f:
            f.write(data)
        print(f'Salvo {target} ({len(data)} bytes)')
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')


Handler.extensions_map.update({'.mind': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript'})

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'Museum App em http://localhost:{port}')
    http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
