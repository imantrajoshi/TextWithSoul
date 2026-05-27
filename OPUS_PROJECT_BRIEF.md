# PROJECT BRIEF — Emotion-Aware Chat Platform
### For: Claude Opus (Development Partner)
### Written by: Claude Sonnet (Concept Partner)
### Status: Concept fully defined. Ready for development phase.

---

## 1. WHO YOU ARE IN THIS PROJECT

You are the **development partner** for this project. The concept has already been fully thought through and validated. Your job is to build it — cleanly, modularly, and in stages. The human (the founder) will direct you. Do not reinvent the concept. Do not simplify it. Build exactly what is described here.

When in doubt about a design or architecture decision, ask the founder before assuming. Every decision you make now will affect layers we add later.

---

## 2. THE CORE CONCEPT (Read This Twice)

Text messaging has a fundamental problem: **the sender feels something, but the receiver reads it in their own flat, emotionless inner voice.**

"Hii Smit!" reads the same whether the sender was excited, nervous, or sad. Emojis are a patch, not a solution. Voice notes are too raw, too personal, too inconvenient.

This product sits in the gap. It gives text messages **a soul.**

### How it works in one sentence:
> The sender speaks → their words become text → their emotion is detected → the receiver reads emotionally-styled text AND can hear it played back in the sender's own AI-cloned voice — with the same emotion intact.

---

## 3. THE FULL PRODUCT FLOW

### 3A. ONBOARDING / SIGNUP
- User signs up with their **phone number**
- OTP verification (mock OTP for now, real SMS later via Twilio or similar)
- After verification, user goes through a **Voice Enrollment Flow**:
  - The system asks them to speak 5–7 pre-defined phrases out loud
  - Example phrases: "Hi, how are you doing today?", "The truck is going down that road.", "I love spending time with the people I care about.", "Can you believe what happened yesterday?", "I'm really excited about this."
  - These phrases are chosen to capture a range of phonetics, pitch, and tone
  - The recordings are sent to the voice cloning service (ElevenLabs API)
  - The system builds a **personal AI Voice Clone** for that user — this is their voice identity on the platform forever
  - This voice clone is stored and associated with their account
- After voice enrollment, user lands on the main chat dashboard

### 3B. SENDING A MESSAGE
1. Inside a chat, the sender sees a **microphone button** (instead of or alongside a text field)
2. They press and hold to record their voice (like WhatsApp voice notes — familiar UX)
3. On release, the following happens **silently and instantly in the background:**
   - Audio is transcribed to text (using OpenAI Whisper API)
   - The transcribed text is displayed in a preview bubble
   - Emotion is detected from the voice recording (using Hume AI or similar emotion detection API) — detecting primary emotion (e.g. excited, sad, angry, happy, anxious, loving, neutral)
4. **The emotion popup only appears if:**
   - The AI detects two or more emotions with similar confidence scores (it is uncertain)
   - In that case, a minimal, fast popup shows: "We detected [Emotion A] and [Emotion B] — which one fits?" with two tappable options
   - If AI is confident (single dominant emotion), NO popup appears. It sends automatically.
5. The message is sent as **TEXT + EMOTION TAG** (e.g. `{text: "Hii Smit!", emotion: "excited", intensity: 0.87}`)
6. The sender's raw voice recording is NOT stored or sent. Only the text and emotion metadata travel.

### 3C. RECEIVING A MESSAGE
The receiver experiences **three simultaneous layers:**

**Layer 1 — READ IT**
The text appears in the chat, readable as normal text. For silent environments (office, metro, library), this alone works.

**Layer 2 — SEE IT (Emotional Visual Styling)**
The text message bubble and the words themselves are visually styled based on the emotion tag:

| Emotion   | Visual Behaviour                                                                 |
|-----------|----------------------------------------------------------------------------------|
| Excited   | Warm orange-yellow tones, words appear with a fast energetic fade-in, slightly larger font, bubble has a glowing warm border |
| Happy     | Bright yellow-green, bouncy word entrance animation, rounded bubble              |
| Sad       | Muted blue-grey palette, slow word appearance, slightly spaced out, softer font weight |
| Angry     | Deep red undertone, text feels sharp and bold, bubble "slams" into view          |
| Anxious   | Slightly unsteady text appearance, cooler muted tones, subtle tremor on words    |
| Loving    | Soft pink-rose warmth, gentle pulse on the bubble, cursive-leaning font feel     |
| Neutral   | Standard styling — no special effect                                             |

**Layer 3 — HEAR IT (AI Voice Playback)**
- Each message has a small **play button**
- When tapped, the message is read aloud by the **sender's personal AI voice clone**
- The voice clone speaks with the **same emotional energy** that was detected from the original recording
- This is NOT a generic TTS voice. It is the sender's voice, reconstructed.
- The receiver hears the message exactly as the sender felt it — their voice, their emotion, their energy

---

## 4. WHAT MAKES THIS DIFFERENT FROM EVERYTHING ELSE

| Feature | WhatsApp | Telegram | This Product |
|---|---|---|---|
| Sends raw voice | ✅ | ✅ | ❌ (intentional — too personal/raw) |
| Emotion in text | ❌ | ❌ | ✅ |
| Receiver's choice to listen | ❌ | ❌ | ✅ |
| Sender's voice, not generic TTS | ❌ | ❌ | ✅ |
| Works silently (text only) | ✅ | ✅ | ✅ |
| Visual emotional styling | ❌ | ❌ | ✅ |

The core insight: **Voice notes feel too raw. Text feels too cold. This is the middle ground that didn't exist before.**

---

## 5. TRUST & SAFETY (Must Be Designed In From Day One)

- The AI voice clone is tied strictly to the authenticated account
- Voice samples collected at signup must be stored encrypted
- No voice clone can be triggered without user authentication
- If an account is deleted, the voice clone data must be permanently purged
- Consider: consent flow during signup making it clear the voice is being cloned and how it is used
- Future consideration (not now): watermarking AI-generated voice output to prevent misuse

---

## 6. TECH STACK

### Frontend
- **React.js** — component-based, modular
- **Tailwind CSS** — utility-first styling
- **Framer Motion** — for emotion-based text animations
- **Socket.io client** — real-time messaging

### Backend
- **Node.js + Express** — REST API
- **Socket.io** — WebSocket real-time layer
- **MongoDB + Mongoose** — database

### External APIs (integrate in phases)
- **OpenAI Whisper** — voice to text transcription
- **Hume AI** — emotion detection from voice
- **ElevenLabs** — voice cloning + emotional TTS playback

### Authentication
- Phone number + OTP
- JWT tokens for session management
- Mock OTP for development (real SMS via Twilio later)

---

## 7. DATABASE SCHEMA (Rough Structure)

```
User {
  _id
  phoneNumber (unique)
  displayName
  profilePhoto
  voiceCloneId (ElevenLabs clone ID — added after enrollment)
  voiceEnrolled: boolean
  createdAt
}

Message {
  _id
  conversationId
  senderId
  receiverId
  text (transcribed content)
  emotion (excited | happy | sad | angry | anxious | loving | neutral)
  emotionIntensity (0.0 to 1.0)
  audioProcessed: boolean
  timestamp
}

Conversation {
  _id
  participants: [userId, userId]
  lastMessage
  lastMessageAt
}
```

---

## 8. BUILD ORDER — DO NOT SKIP STEPS

Build in this exact sequence. Do not jump ahead. Each phase must be working before moving to the next.

### PHASE 1 — Foundation (Start Here)
- [ ] Project structure setup (React frontend + Node backend, monorepo or separate)
- [ ] MongoDB connection
- [ ] User authentication: phone number signup, mock OTP, JWT
- [ ] Basic user profile (display name, photo upload optional)
- [ ] Chat dashboard UI — list of conversations
- [ ] Search users to start a new conversation
- [ ] Real-time 1-on-1 text messaging via Socket.io
- [ ] Messages stored in DB with timestamps
- [ ] Clean, modern chat UI (WhatsApp Web / Telegram Web feel — but more expressive)
- [ ] Mobile responsive

### PHASE 2 — Voice Input & Transcription
- [ ] Voice enrollment flow at signup (record phrases → send to ElevenLabs → store clone ID)
- [ ] Voice recording button in chat (press and hold)
- [ ] Whisper API integration — transcribe recording to text
- [ ] Show transcribed text preview before sending

### PHASE 3 — Emotion Detection
- [ ] Hume AI integration — detect emotion from voice recording
- [ ] Silent auto-tagging of messages with emotion
- [ ] Uncertainty popup (only when AI confidence is split)
- [ ] Store emotion + intensity in message object

### PHASE 4 — Emotional Visual Rendering
- [ ] Emotion-based message bubble styling (colors, borders, font weight)
- [ ] Framer Motion animations per emotion (entrance animation style)
- [ ] Smooth transitions — should feel alive, not gimmicky

### PHASE 5 — AI Voice Playback
- [ ] Play button on each received message
- [ ] ElevenLabs TTS — use sender's voice clone + emotion to generate audio
- [ ] Stream or cache audio for fast playback
- [ ] Playback UI (waveform or simple progress bar)

---

## 9. DESIGN PHILOSOPHY

- **Minimal friction above everything.** Every extra tap is a reason to quit.
- **The emotion should feel native, not bolted on.** It should feel like the app was always emotional, not like a feature was added.
- **Dark mode first.** Emotional colors pop on dark backgrounds.
- **Sound is optional, always.** Never auto-play. Receiver chooses when to listen.
- **Animations must be fast.** Under 300ms. Emotion should feel instant, not dramatic.

---

## 10. WHAT TO BUILD RIGHT NOW

Start with **Phase 1 only.**

Give the founder:
1. Full folder/file structure for the project
2. Working authentication (phone + mock OTP + JWT)
3. Real-time chat between two users
4. Clean chat UI

Ask before making any decisions that will affect Phase 2 onwards — especially database schema and API structure. Those choices echo through everything.

---

*This brief was written after several hours of concept development between the founder and Claude Sonnet. Every design decision in here has a reason. Build it with that respect.*
