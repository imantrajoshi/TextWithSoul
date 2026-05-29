/*
 * Voice-tone emotion detection — calls the FREE local SER service (emotion.py).
 * Detects emotion from HOW a voice note was said (tone), so an angry/sad delivery
 * isn't missed just because the words are neutral. Returns { emotion, score } or
 * null if the service is unset/unreachable (so callers fall back to text).
 */
export const detectVoiceEmotion = async (buffer, filename = 'audio.webm') => {
  const url = process.env.EMOTION_URL;
  if (!url || !buffer?.length) return null;
  try {
    const form = new FormData();
    form.append('audio', new Blob([buffer]), filename);
    const r = await fetch(`${url.replace(/\/$/, '')}/emotion`, { method: 'POST', body: form });
    if (!r.ok) return null;
    const data = await r.json();
    return data && typeof data.emotion === 'string' ? data : null;
  } catch {
    return null;
  }
};
