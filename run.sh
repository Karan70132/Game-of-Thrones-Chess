#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python manage.py migrate
printf '\nOpen http://127.0.0.1:8000/ in your browser. Ctrl+C stops the server.\n\n'
exec .venv/bin/python manage.py runserver 127.0.0.1:8000
