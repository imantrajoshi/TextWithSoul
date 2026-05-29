#!/usr/bin/env bash
# Start the FREE local voice-tone emotion detector (SER) on port 8002.
# Reuses the Chatterbox venv (Python 3.11 with torch + transformers already there),
# so the only first-run download is the small SER model (~360MB).
set -e
cd "$(dirname "$0")"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it:  brew install ffmpeg"
  exit 1
fi

VENV=".venv-chatterbox"
if [ ! -d "$VENV" ]; then
  echo "$VENV not found — run ./run-chatterbox.sh once first (it builds the shared venv)."
  exit 1
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"

export PRELOAD=1
export PORT="${PORT:-8002}"
echo "Starting voice-tone emotion service on http://127.0.0.1:${PORT}"
python emotion.py
