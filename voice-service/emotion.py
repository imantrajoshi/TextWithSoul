"""
Vybe voice-tone emotion detector — FREE, local Speech Emotion Recognition (SER).

Detects emotion from HOW something was said (tone/prosody), to complement the
text-based word analysis. This is what catches an angry or sad TONE even when the
words are neutral — the gap the founder kept hitting.

Model: superb/wav2vec2-base-superb-er (Apache-2.0) → labels neutral/happy/angry/sad.
Runs on CPU. Reuses the Chatterbox venv (torch + transformers already installed).

Run:  ./run-emotion.sh   (serves on http://127.0.0.1:8002)
"""

import os
import shutil
import subprocess
import tempfile
import threading

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile

app = FastAPI(title="Vybe Emotion (SER)")

_pipe = None
_load_lock = threading.Lock()
_model = os.environ.get("SER_MODEL", "superb/wav2vec2-base-superb-er")

# Model labels → our product emotions. Covers both the 4-class (neu/hap/ang/sad)
# and 8-class (angry/calm/disgust/fearful/happy/neutral/sad/surprised) SER models.
# loving isn't an acoustic category — that nuance comes from the text analysis.
LABEL_MAP = {
    "neu": "neutral", "neutral": "neutral", "calm": "neutral",
    "hap": "happy", "happy": "happy",
    "ang": "angry", "angry": "angry", "disgust": "angry",
    "sad": "sad", "sadness": "sad",
    "fear": "anxious", "fearful": "anxious",
    "sur": "excited", "surprise": "excited", "surprised": "excited",
}


def get_pipe():
    global _pipe
    if _pipe is None:
        with _load_lock:
            if _pipe is None:
                from transformers import pipeline
                print(f"[emotion] loading SER model: {_model} ...", flush=True)
                _pipe = pipeline("audio-classification", model=_model, top_k=None)
                print("[emotion] model ready.", flush=True)
    return _pipe


def to_wav16k(src_path: str) -> str:
    """SER models expect 16kHz mono. Convert whatever the browser sent."""
    out = src_path + ".wav"
    proc = subprocess.run(
        ["ffmpeg", "-y", "-i", src_path, "-ar", "16000", "-ac", "1", out],
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode()[-300:])
    return out


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": _model,
        "loaded": _pipe is not None,
        "ffmpeg": shutil.which("ffmpeg") is not None,
    }


@app.post("/emotion")
async def emotion(audio: UploadFile = File(...)):
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=500, detail="ffmpeg not installed")

    tmpdir = tempfile.mkdtemp(prefix="vybe-ser-")
    raw = os.path.join(tmpdir, audio.filename or "input")
    with open(raw, "wb") as f:
        f.write(await audio.read())

    try:
        wav = to_wav16k(raw)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"audio decode failed: {e}")

    try:
        preds = get_pipe()(wav)  # [{label, score}, ...]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"inference failed: {e}")

    scores = {}
    for p in preds:
        emo = LABEL_MAP.get(str(p["label"]).lower())
        if emo:
            scores[emo] = max(scores.get(emo, 0.0), float(p["score"]))

    if not scores:
        return {"emotion": "neutral", "score": 0.0, "scores": {}}
    top = max(scores, key=scores.get)
    return {"emotion": top, "score": round(scores[top], 3), "scores": {k: round(v, 3) for k, v in scores.items()}}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8002"))
    if os.environ.get("PRELOAD") == "1":
        get_pipe()
    uvicorn.run(app, host="127.0.0.1", port=port)
