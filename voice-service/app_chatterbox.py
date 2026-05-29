"""
Vybe Voice Clone — Chatterbox (Resemble AI) SPIKE.

Same HTTP contract as the XTTS service (POST /synthesize: text + language +
speaker file -> audio/wav) so the Node backend needs ZERO changes — flipping
between engines is just pointing VOICE_CLONE_URL at this port (default 8001)
instead of the XTTS port (8000).

Why this spike: XTTS-v2 is non-commercial licensed. Chatterbox is **MIT** (free
for commercial use), zero-shot clones from a short reference clip, and has a
built-in `exaggeration` emotion knob. If it sounds good on our enrollment
samples, we ship it and retire XTTS.

NOTE: Chatterbox conveys emotion via the `exaggeration` parameter, NOT from the
reference clip's prosody (unlike XTTS). For the spike we use the default; wiring
our detected-emotion label -> exaggeration is the follow-up if we ship.

Run:  ./run-chatterbox.sh   (needs Python 3.11 — `brew install python@3.11`)
"""

import os
import shutil
import subprocess
import tempfile
import threading

import torch  # noqa: F401  (ensures torch is importable before model load)
import torchaudio as ta
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

app = FastAPI(title="Vybe Voice Clone (Chatterbox)")

_model = None
_load_lock = threading.Lock()
_device = os.environ.get("CHATTERBOX_DEVICE", "cpu")  # cpu is safest on Apple Silicon


def get_model():
    global _model
    if _model is None:
        with _load_lock:
            if _model is None:
                from chatterbox.tts import ChatterboxTTS
                print(f"[chatterbox] loading model on {_device} ...", flush=True)
                _model = ChatterboxTTS.from_pretrained(device=_device)
                print("[chatterbox] model ready.", flush=True)
    return _model


def to_wav(src_path: str) -> str:
    """Convert any input (webm/opus/...) to 24kHz mono WAV via ffmpeg."""
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
        "engine": "chatterbox",
        "device": _device,
        "model_loaded": _model is not None,
        "ffmpeg": shutil.which("ffmpeg") is not None,
    }


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    language: str = Form("en"),          # accepted for contract parity; English base model
    exaggeration: float = Form(0.5),     # Chatterbox emotion knob (0..1)
    cfg_weight: float = Form(0.5),
    speaker: UploadFile = File(...),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=500, detail="ffmpeg not installed (brew install ffmpeg)")

    tmpdir = tempfile.mkdtemp(prefix="vybe-cbx-")
    ref_in = os.path.join(tmpdir, speaker.filename or "reference")
    with open(ref_in, "wb") as f:
        f.write(await speaker.read())

    try:
        ref_wav = to_wav(ref_in)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"audio decode failed: {e}")

    out_wav = os.path.join(tmpdir, "clone.wav")
    try:
        model = get_model()
        wav = model.generate(
            text,
            audio_prompt_path=ref_wav,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
        if hasattr(wav, "detach"):
            wav = wav.detach().cpu()
        if wav.ndim == 1:
            wav = wav.unsqueeze(0)
        ta.save(out_wav, wav, model.sr)
    except Exception as e:  # noqa: BLE001 - surface any synthesis error to the caller
        raise HTTPException(status_code=500, detail=f"synthesis failed: {e}")

    return FileResponse(out_wav, media_type="audio/wav", filename="clone.wav")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8001"))
    if os.environ.get("PRELOAD") == "1":
        get_model()
    uvicorn.run(app, host="127.0.0.1", port=port)
