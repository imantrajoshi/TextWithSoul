"""
Vybe Voice Clone service — FREE, self-hosted, zero-spend.

Clones a speaker's voice from a short reference clip (the enrollment sample the
Node backend sends) and speaks arbitrary text in that voice using Coqui XTTS-v2.

Why this exists: the product's headline feature is hearing a message in the
SENDER'S OWN voice. Paid APIs (ElevenLabs) cost money; XTTS-v2 runs locally for
free. The Node backend calls POST /synthesize in place of ElevenLabs and falls
back to free browser TTS if this service isn't running.

LICENSE NOTE: XTTS-v2 is released under the Coqui non-commercial license — fine
for this experimental prototype/demo, MUST be swapped (e.g. OpenVoice MIT, or a
commercial TTS) before any paid launch.

Run:  ./run.sh    (creates a venv, installs deps, downloads the model on first use)
"""

import os
import shutil
import tempfile
import threading
import subprocess

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

app = FastAPI(title="Vybe Voice Clone (XTTS-v2)")

_tts = None
_load_lock = threading.Lock()
_model_name = os.environ.get("XTTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")


def get_tts():
    """Lazy-load the model once (it is ~1.8GB and slow to load)."""
    global _tts
    if _tts is None:
        with _load_lock:
            if _tts is None:
                # Accept the XTTS-v2 non-commercial license non-interactively.
                os.environ.setdefault("COQUI_TOS_AGREED", "1")
                from TTS.api import TTS  # provided by the `coqui-tts` package
                print(f"[voice-service] loading model: {_model_name} (CPU) ...", flush=True)
                _tts = TTS(_model_name)
                print("[voice-service] model ready.", flush=True)
    return _tts


def to_wav(src_path: str) -> str:
    """Convert any input (webm/opus/mp3/...) to 24kHz mono WAV via ffmpeg."""
    out = src_path + ".wav"
    proc = subprocess.run(
        ["ffmpeg", "-y", "-i", src_path, "-ar", "24000", "-ac", "1", out],
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode()[-300:])
    return out


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": _model_name,
        "model_loaded": _tts is not None,
        "ffmpeg": shutil.which("ffmpeg") is not None,
    }


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    language: str = Form("en"),
    speaker: UploadFile = File(...),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=500, detail="ffmpeg not installed (brew install ffmpeg)")

    tmpdir = tempfile.mkdtemp(prefix="vybe-clone-")
    ref_in = os.path.join(tmpdir, speaker.filename or "reference")
    with open(ref_in, "wb") as f:
        f.write(await speaker.read())

    try:
        ref_wav = to_wav(ref_in)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"audio decode failed: {e}")

    out_wav = os.path.join(tmpdir, "clone.wav")
    try:
        tts = get_tts()
        tts.tts_to_file(text=text, speaker_wav=ref_wav, language=language, file_path=out_wav)
    except Exception as e:  # noqa: BLE001 - surface any synthesis error to the caller
        raise HTTPException(status_code=500, detail=f"synthesis failed: {e}")

    return FileResponse(out_wav, media_type="audio/wav", filename="clone.wav")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    if os.environ.get("PRELOAD") == "1":
        get_tts()  # warm the model so the first message isn't slow
    uvicorn.run(app, host="127.0.0.1", port=port)
