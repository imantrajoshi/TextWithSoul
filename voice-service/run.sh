#!/usr/bin/env bash
# Start the FREE local voice-clone (XTTS-v2) service.
# First run creates a venv, installs deps, and downloads the model (~1.8GB).
set -e
cd "$(dirname "$0")"

# ffmpeg is required to decode the .webm enrollment samples.
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it first:  brew install ffmpeg"
  exit 1
fi

if [ ! -d .venv ]; then
  echo "Creating virtualenv..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

python -m pip install --upgrade pip >/dev/null
echo "Installing dependencies (first run downloads torch — this can take a while)..."
pip install -r requirements.txt

# Auto-accept the XTTS-v2 non-commercial license (prototype use only).
export COQUI_TOS_AGREED=1
export PRELOAD=1
export PORT="${PORT:-8000}"

echo "Starting voice-clone service on http://127.0.0.1:${PORT}"
python app.py
