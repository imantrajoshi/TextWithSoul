# TextWithSoul (codename: Vybe)

> **⚠️ EXPERIMENTAL PROTOTYPE — NOT PRODUCTION.**
> This is an investor-demo / proof-of-concept build. Its only goal is to prove the
> full emotional-messaging flow works end to end. **Zero-spend policy:** we do not
> pay a single penny for any API during this phase. Paid services run only inside
> their free tiers and gracefully fall back to free mocks/stubs when unavailable.

## The concept

Text messaging loses the sender's emotion — the receiver reads everything in their
own flat inner voice. TextWithSoul puts the soul back in:

> The sender **speaks** → words become **text** → their **emotion** is detected →
> the receiver **reads** emotionally-styled text, **sees** it animate by emotion, and
> can **hear** it played back with matching emotional energy.

(Full original concept: see [`OPUS_PROJECT_BRIEF.md`](./OPUS_PROJECT_BRIEF.md).)

## Tech stack

- **Frontend:** React + Vite, Tailwind, Framer Motion, Socket.io client
- **Backend:** Node + Express, Socket.io, MongoDB/Mongoose, JWT auth
- **External (premium) APIs:** Hume AI (emotion), ElevenLabs (voice)

## Free Tier vs Production

Every external capability has a **free path used now** and a **paid path planned for
launch**. The architecture is ready to swap one for the other.

| Capability | Now (prototype — free / mocked) | Production (paid, planned) |
|---|---|---|
| **Speech → text** | Browser **Web Speech API** (free, runs client-side). *Trade-off: needs Chrome/Edge + internet.* | On-device or paid model (e.g. OpenAI Whisper) for privacy + cross-browser support. |
| **Emotion detection** | **Hume AI** inside its free credits; on missing key / quota / timeout it degrades to a built-in **mock emotion generator**. | Hume AI on a paid plan (or a custom prosody model). |
| **Voice playback** | **ElevenLabs** free tier (a shared default voice). On missing key / quota it degrades to the browser's **SpeechSynthesis** voice (free). | ElevenLabs paid tier with each user's **own cloned voice**. |

### Graceful degradation (how zero-spend is enforced)

If a free-tier limit is hit, **we never upgrade** — instead the feature stubs out so
the rest of the app keeps working:

- **Hume** unavailable → server returns mock emotions, so the emotional UI still demos.
- **ElevenLabs** unavailable → server replies `503 { fallback: 'browser-tts' }` and the
  client plays the message with the free browser voice (emotion conveyed via rate/pitch).
- Audio that fails to transcribe never blocks sending — the message just goes out as typed.

### Watching usage

Calls to the paid APIs are logged to the server console (`[USAGE][PAID] …`) and a live
snapshot is available at `GET /api/voice/usage` (auth required). These are
per-process approximations to help us stay inside free tiers — not authoritative billing.

> ❌ **OpenAI Whisper has been removed entirely.** It was dead code (transcription is
> handled free in the browser) and is documented above only as a production option.

## Local setup

```bash
# Backend
cd server
npm install
cp .env.example .env   # then fill values (MongoDB URI, JWT secret, optional API keys)
npm run dev

# Frontend (separate terminal)
cd client
npm install
npm run dev
```

API keys are **optional in development** — leave `HUME_API_KEY` / `ELEVENLABS_API_KEY`
empty and the app runs fully on free mocks/stubs.
