#!/usr/bin/env bash
# Emotion → exaggeration tuning harness (by EAR).
# Generates each emotion at a few (exaggeration, cfg_weight) settings using a
# reference clip, so you can audition and pick the best value per emotion.
# Hits the Chatterbox service directly (:8001), bypassing the cache.
#
# Usage:
#   ./tune.sh [reference.wav|.webm]
# If no reference is given, it uses the most-recently-recorded enrollment clip
# (i.e. your freshly re-enrolled voice). Output → voice-service/tuning/.
set -e
cd "$(dirname "$0")/.."   # repo root

URL="${VOICE_CLONE_URL:-http://127.0.0.1:8001}"
if ! curl -sf "$URL/health" >/dev/null 2>&1; then
  echo "Chatterbox service not reachable at $URL — start it: voice-service/run-chatterbox.sh"
  exit 1
fi

REF="$1"
if [ -z "$REF" ]; then
  REF=$(ls -t server/uploads/voice-samples/*/neutral.webm 2>/dev/null | head -1)
  [ -z "$REF" ] && REF=$(ls -t server/uploads/voice-samples/*/*.webm 2>/dev/null | head -1)
fi
if [ -z "$REF" ] || [ ! -f "$REF" ]; then
  echo "No reference clip found. Enroll a voice first, or pass one: ./tune.sh path/to/ref.wav"
  exit 1
fi
echo "Reference: $REF"

OUT="voice-service/tuning"
mkdir -p "$OUT"
rm -f "$OUT"/*.wav 2>/dev/null || true

# emotion | sentence | "exagg:cfg exagg:cfg ..."
GRID=(
  "neutral|The meeting is scheduled for three o'clock today.|0.30:0.5 0.40:0.5"
  "happy|Hey! It's so good to finally hear from you.|0.50:0.5 0.60:0.5 0.70:0.4"
  "excited|I can't wait, this is going to be amazing!|0.70:0.5 0.85:0.4 1.00:0.3"
  "sad|I really miss how things used to be.|0.35:0.5 0.45:0.5 0.60:0.5"
  "angry|I am so done with this, it's absolutely ridiculous.|0.60:0.5 0.80:0.4 0.95:0.3"
  "anxious|I'm really nervous about tomorrow, what if it goes wrong?|0.50:0.5 0.65:0.45 0.80:0.4"
  "loving|You mean the world to me, truly.|0.45:0.5 0.55:0.5 0.70:0.45"
)

for row in "${GRID[@]}"; do
  emo="${row%%|*}"; rest="${row#*|}"; text="${rest%%|*}"; combos="${rest##*|}"
  for combo in $combos; do
    ex="${combo%%:*}"; cfg="${combo##*:}"
    f="$OUT/${emo}_e${ex}_c${cfg}.wav"
    printf "  %-8s exagg=%s cfg=%s ... " "$emo" "$ex" "$cfg"
    curl -s -X POST "$URL/synthesize" \
      -F "text=$text" -F "exaggeration=$ex" -F "cfg_weight=$cfg" \
      -F "speaker=@$REF" -o "$f" -w "%{time_total}s\n"
  done
done

echo
echo "Done. Listen:  open \"$OUT\""
echo "Then tell me the best exaggeration/cfg per emotion and I'll bake them in."
