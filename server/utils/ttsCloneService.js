import fs from 'fs/promises';
import path from 'path';

/*
 * Shared voice-clone (XTTS) logic used by BOTH the on-demand /voice/synthesize
 * controller and the background pre-generation that runs right after a message
 * is sent. Generated audio is cached to disk keyed by messageId so the first
 * playback is instant. FREE / zero-spend — only the local XTTS service is used
 * here (ElevenLabs is intentionally NOT pre-generated, to protect its quota).
 */

const VOICE_SAMPLE_EMOTIONS = ['neutral', 'happy', 'excited', 'sad', 'angry', 'anxious', 'loving'];

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

// Sender's enrolled sample for the emotion (typed lane): prefer the emotion,
// then neutral, then any available sample.
const findReferenceSample = async (senderId, emotion) => {
  if (!senderId || !/^[a-f0-9]{24}$/i.test(String(senderId))) return null;
  const dir = path.join(process.cwd(), 'uploads', 'voice-samples', String(senderId));
  const order = [emotion, 'neutral', ...VOICE_SAMPLE_EMOTIONS].filter(
    (e, i, arr) => VOICE_SAMPLE_EMOTIONS.includes(e) && arr.indexOf(e) === i
  );
  for (const e of order) {
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

// The actual recording the sender made for THIS message (voice lane).
const findVoiceMessageClip = async (senderId, voiceClipId) => {
  if (!senderId || !/^[a-f0-9]{24}$/i.test(String(senderId))) return null;
  if (!voiceClipId || !/^[0-9a-f-]{36}$/i.test(String(voiceClipId))) return null;
  const p = path.join(process.cwd(), 'uploads', 'voice-messages', String(senderId), `${voiceClipId}.webm`);
  try {
    await fs.access(p);
    return p;
  } catch {
    return null;
  }
};

// Pick the clone reference: the message's own recording if present, else the
// sender's enrolled sample for the emotion. Returns a path or null.
export const resolveReference = async ({ senderId, emotion, voiceClipId }) =>
  (await findVoiceMessageClip(senderId, voiceClipId)) || (await findReferenceSample(senderId, emotion));

// Call the local XTTS service. Throws if VOICE_CLONE_URL is unset or the request
// fails, so callers can fall back gracefully.
export const cloneWithXTTS = async ({ text, refPath, language = 'en' }) => {
  const cloneUrl = process.env.VOICE_CLONE_URL;
  if (!cloneUrl) throw new Error('VOICE_CLONE_URL not set');
  const buf = await fs.readFile(refPath);
  const form = new FormData();
  form.append('text', text);
  form.append('language', language);
  form.append('speaker', new Blob([buf]), path.basename(refPath));

  const r = await fetch(`${cloneUrl.replace(/\/$/, '')}/synthesize`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`XTTS responded ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

// Generate the cloned wav for a message and write it to the disk cache.
// Returns the cache path. Throws if there's no reference or the clone fails.
export const generateAndCache = async ({ messageId, text, senderId, emotion, voiceClipId }) => {
  if (!isValidMessageId(messageId)) throw new Error('invalid messageId');
  const refPath = await resolveReference({ senderId, emotion, voiceClipId });
  if (!refPath) throw new Error('no reference clip for sender');
  const wav = await cloneWithXTTS({ text, refPath });
  await fs.mkdir(ttsCacheDir(), { recursive: true });
  const out = cachePathFor(messageId);
  await fs.writeFile(out, wav);
  return out;
};
