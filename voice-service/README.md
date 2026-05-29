# Vybe Voice Clone Service (XTTS-v2) — FREE / self-hosted

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
  swap to OpenVoice (MIT) or a commercial TTS before a paid launch.
