# Vybe Voice Clone Service — FREE / self-hosted

> **Active engine: Chatterbox (MIT, port 8001)** — see the Chatterbox section below.
> XTTS-v2 (port 8000, this doc) is kept running as a one-line-revert fallback
> (`VOICE_CLONE_URL=http://127.0.0.1:8000`). We moved to Chatterbox because it's
> license-safe AND separates voice identity (stable reference) from emotion
> (`exaggeration`), which fixed the per-emotion pitch drift.

---

# XTTS-v2 (fallback engine)

Speaks any text in a **sender's own voice**, cloned from a short reference clip.
This is the real voice-clone engine that replaces the placeholder ElevenLabs
voice. It runs entirely on your machine — **zero spend**.

The Node backend (`server/`) calls `POST /synthesize` here. If this service is
not running, the app falls back to the free browser voice, so nothing breaks.

## One-time setup

```bash
brew install ffmpeg          # decodes the .webm enrollment samples
cd voice-service
./run.sh                     # creates a venv, installs deps, downloads the model
```

First run downloads PyTorch + the XTTS-v2 model (~1.8GB) and can take several
minutes. After that it starts on `http://127.0.0.1:8000`.

## Point the backend at it

In `server/.env`:

```
VOICE_CLONE_URL=http://127.0.0.1:8000
```

Restart the Node server. Now pressing ▶ on a message asks this service to speak
it in the sender's enrolled voice for that emotion.

## API

- `GET /health` → `{ status, model, model_loaded, ffmpeg }`
- `POST /synthesize` (multipart): `text`, `language` (default `en`), `speaker`
  (the reference audio file) → returns `audio/wav`.

## Notes

- **CPU inference** on a Mac is a few seconds per message; the client caches
  generated audio so replays are instant.
- **License:** XTTS-v2 is **non-commercial**. Fine for this prototype/demo;
  the Chatterbox spike below is the license-safe path.

---

# Chatterbox engine (MIT) — license-safe alternative [SPIKE]

`app_chatterbox.py` is a drop-in alternative running **Chatterbox (Resemble AI)**,
which is **MIT-licensed (commercial OK)**. It exposes the **same `/synthesize`
contract** as the XTTS service, so swapping engines is just changing which port
`VOICE_CLONE_URL` points at — the Node backend doesn't change.

```bash
brew install ffmpeg
brew install python@3.11      # Chatterbox needs Python >=3.10
cd voice-service
./run-chatterbox.sh           # separate venv (.venv-chatterbox), serves on :8001
```

To use it instead of XTTS, set in `server/.env`:

```
VOICE_CLONE_URL=http://127.0.0.1:8001
```

Differences vs XTTS:
- **License:** MIT (commercial OK) vs XTTS non-commercial. This is the reason to swap.
- **Emotion:** Chatterbox controls emotion via an `exaggeration` knob (0–1, default
  0.5), **not** from the reference clip's prosody. Follow-up if we ship: map our
  detected emotion → `exaggeration`. The `/synthesize` endpoint already accepts an
  optional `exaggeration` form field.
- Cloning is zero-shot from a ~5s reference, same as XTTS. CPU inference on a Mac.

---

# Voice-tone emotion detector (`emotion.py`) — EXPERIMENTAL, currently OFF

`emotion.py` is a Speech Emotion Recognition (SER) service meant to detect emotion
from *how* a voice note was said (tone), not just the words. It's wired into the
backend behind `EMOTION_URL` in `server/.env` — **left commented out / OFF** because
the free off-the-shelf models we tried were not usable:

- `superb/wav2vec2-base-superb-er` — collapsed to "angry" on nearly all real mic
  clips (trained on studio-acted IEMOCAP; poor real-world generalization).
- `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition` — its trained
  classifier head doesn't load through the standard `pipeline`, so predictions are
  random (uniform ~0.12 across classes).

The live mechanism for tone is the **emotion confirm popup** (`EmotionConfirm.jsx`):
the sender taps how they said it — reliable and one tap. To revisit auto-detection,
options are: load ehcalabres' custom model class properly, fine-tune on real data,
or use a paid API (e.g. Hume). To re-enable once a good model is found:

```bash
cd voice-service && SER_MODEL=<good-model> ./run-emotion.sh   # serves on :8002
# then uncomment EMOTION_URL=http://127.0.0.1:8002 in server/.env and restart the backend
```

OpenVoice (also MIT) remains a documented fallback if Chatterbox disappoints — not built.
