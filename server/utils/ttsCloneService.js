import fs from 'fs/promises';
import path from 'path';

/*
 * Shared voice-clone (XTTS) logic used by BOTH the on-demand /voice/synthesize
 * controller and the background pre-generation that runs right after a message
 * is sent. Generated audio is cached to disk keyed by messageId so the first
 * playback is instant. FREE / zero-spend — only the local XTTS service is used
 * here (ElevenLabs is intentionally NOT pre-generated, to protect its quota).
 */

// Fixed priority for the STABLE identity reference. The same clip is used for
// every typed message from a sender (regardless of the message's emotion) so
// the cloned voice keeps ONE consistent identity. Emotion is conveyed by the
// engine's `exaggeration` knob instead — swapping the reference per emotion
// made the same person drift between higher/lower pitch (the "girly" bug).
const STABLE_REF_ORDER = ['neutral', 'happy', 'excited', 'loving', 'sad', 'angry', 'anxious'];

// Map our 7 emotions → Chatterbox `exaggeration` (0..1). Higher = more dramatic.
// Ignored by the XTTS engine. Tunable by ear.
const EMOTION_EXAGGERATION = {
  neutral: 0.35,
  happy: 0.6,
  excited: 0.85,
  sad: 0.45,
  angry: 0.8,
  anxious: 0.6,
  loving: 0.55,
};
const exaggerationFor = (emotion) => EMOTION_EXAGGERATION[emotion] ?? 0.5;

export const isValidMessageId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

const ttsCacheDir = () => path.join(process.cwd(), 'uploads', 'tts-cache');
export const cachePathFor = (messageId) => path.join(ttsCacheDir(), `${messageId}.wav`);

// Returns the cached wav path if it already exists, else null.
export const getCachedPath = async (messageId) => {
  if (!isValidMessageId(messageId)) return null;
  const p = cachePathFor(messageId);
  try {
    await fs.access(p);
    return p;
  } catch {
    return null;
  }
};

// Sender's STABLE identity sample (typed lane): the same clip every time,
// independent of the message emotion, so the cloned voice stays one person.
const findStableReference = async (senderId) => {
  if (!senderId || !/^[a-f0-9]{24}$/i.test(String(senderId))) return null;
  const dir = path.join(process.cwd(), 'uploads', 'voice-samples', String(senderId));
  for (const e of STABLE_REF_ORDER) {
    const p = path.join(dir, `${e}.webm`);
    try {
      await fs.access(p);
      return p;
    } catch {
      /* keep looking */
    }
  }
  return null;
};

// The clone reference is ALWAYS the sender's permanent enrolled voice identity.
// We never clone from a per-message recording — the raw voice is not stored or
// played back (see PROJECT BRIEF §3B.6 / §4); only the sender's voice clone speaks
// the text. Returns a path or null.
export const resolveReference = async ({ senderId }) => findStableReference(senderId);

// Call the local clone service (Chatterbox or XTTS — same HTTP contract).
// `exaggeration` (derived from emotion) is used by Chatterbox and ignored by
// XTTS. Throws if VOICE_CLONE_URL is unset or the request fails, so callers can
// fall back gracefully.
export const cloneViaService = async ({ text, refPath, language = 'en', emotion = 'neutral' }) => {
  const cloneUrl = process.env.VOICE_CLONE_URL;
  if (!cloneUrl) throw new Error('VOICE_CLONE_URL not set');
  const buf = await fs.readFile(refPath);
  const form = new FormData();
  form.append('text', text);
  form.append('language', language);
  form.append('exaggeration', String(exaggerationFor(emotion)));
  form.append('speaker', new Blob([buf]), path.basename(refPath));

  const r = await fetch(`${cloneUrl.replace(/\/$/, '')}/synthesize`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`clone service responded ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

// Generate the cloned wav for a message and write it to the disk cache.
// Returns the cache path. Throws if there's no reference or the clone fails.
export const generateAndCache = async ({ messageId, text, senderId, emotion }) => {
  if (!isValidMessageId(messageId)) throw new Error('invalid messageId');
  const refPath = await resolveReference({ senderId });
  if (!refPath) throw new Error('no enrolled voice for sender');
  const wav = await cloneViaService({ text, refPath, emotion });
  await fs.mkdir(ttsCacheDir(), { recursive: true });
  const out = cachePathFor(messageId);
  await fs.writeFile(out, wav);
  return out;
};
