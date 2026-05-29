#!/usr/bin/env bash
# Start the Chatterbox (MIT) voice-clone SPIKE on port 8001 — separate venv from
# XTTS so the working service is never disturbed. Needs Python 3.11.
# First run installs deps and downloads the model.
set -e
cd "$(dirname "$0")"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it:  brew install ffmpeg"
  exit 1
fi

PYBIN="${PYBIN:-python3.11}"
if ! command -v "$PYBIN" >/dev/null 2>&1; then
  echo "$PYBIN not found. Chatterbox needs Python >=3.10:  brew install python@3.11"
  exit 1
fi

if [ ! -d .venv-chatterbox ]; then
  echo "Creating virtualenv (.venv-chatterbox) from $PYBIN ..."
  "$PYBIN" -m venv .venv-chatterbox
fi
# shellcheck disable=SC1091
source .venv-chatterbox/bin/activate

python -m pip install --upgrade pip >/dev/null
echo "Installing Chatterbox dependencies (first run downloads torch — slow)..."
pip install -r requirements-chatterbox.txt

export PRELOAD=1
export PORT="${PORT:-8001}"
export CHATTERBOX_DEVICE="${CHATTERBOX_DEVICE:-cpu}"

echo "Starting Chatterbox voice-clone service on http://127.0.0.1:${PORT}"
python app_chatterbox.py
