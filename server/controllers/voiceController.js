import WebSocket from 'ws';
import axios from 'axios';
import { EMOTION_VOICE_SETTINGS } from '../constants/emotionVoiceSettings.js';
import { trackHume, trackElevenLabs, getUsage } from '../utils/usageTracker.js';
import { analyzeText } from '../utils/emotionAnalyzer.js';

/*
 * ──────────────────────────────────────────────────────────────────────────
 * EXPERIMENTAL PROTOTYPE — ZERO-SPEND POLICY
 * ──────────────────────────────────────────────────────────────────────────
 * Speech-to-text is done FOR FREE in the browser (Web Speech API — see
 * client/src/components/chat/MessageInput.jsx). There is intentionally NO
 * server-side transcription; OpenAI Whisper was removed so we never spend.
 *
 * Hume AI (emotion) and ElevenLabs (voice) below are PAID premium integrations
 * kept "architecturally ready" for the production launch. In this phase they
 * run only inside their free tiers; usage is logged via usageTracker. If a call
 * fails (missing key, quota, rate-limit, timeout) we gracefully fall back to a
 * FREE mock/stub so the end-to-end demo never breaks.
 * See README → "Free Tier vs Production".
 * ──────────────────────────────────────────────────────────────────────────
 */

// Hume's raw emotion labels → our 7 product emotions.
const EMOTION_MAP = {
  'Amusement': 'happy',
  'Joy': 'happy',
  'Excitement': 'excited',
  'Sadness': 'sad',
  'Disappointment': 'sad',
  'Anger': 'angry',
  'Frustration': 'angry',
  'Anxiety': 'anxious',
  'Fear': 'anxious',
  'Nervousness': 'anxious',
  'Admiration': 'loving',
  'Love': 'loving',
  'Romance': 'loving',
  'Tenderness': 'loving',
};

// FREE fallback: plausible emotion scores used when the PAID Hume API is
// unavailable (no key) or unreachable (quota / rate-limit / timeout), so the
// emotional UI keeps demonstrating end-to-end at zero spend.
const mockEmotions = () => {
  const rand = Math.random();
  if (rand < 0.33) return [{ name: 'Joy', score: 0.9 }];
  if (rand < 0.66) return [{ name: 'Anger', score: 0.85 }];
  // Split confidence → exercises the uncertainty popup path.
  return [
    { name: 'Joy', score: 0.85 },
    { name: 'Sadness', score: 0.80 },
  ];
};

const mapHumeToVybe = (humeEmotions) => {
  if (!humeEmotions || humeEmotions.length === 0) {
    return { emotion: 'neutral', emotionIntensity: 0, isUncertain: false, uncertaintyOptions: null };
  }

  const sorted = [...humeEmotions].sort((a, b) => b.score - a.score);
  const topHume = sorted[0];
  const secondHume = sorted[1];

  const topTag = EMOTION_MAP[topHume.name] || 'neutral';
  const secondTag = secondHume ? (EMOTION_MAP[secondHume.name] || 'neutral') : 'neutral';

  let isUncertain = false;
  let uncertaintyOptions = null;

  if (secondHume && topTag !== secondTag && topTag !== 'neutral' && secondTag !== 'neutral') {
    const scoreDiff = topHume.score - secondHume.score;
    if (scoreDiff <= 0.15) {
      isUncertain = true;
      uncertaintyOptions = [topTag, secondTag];
    }
  }

  return {
    emotion: topTag,
    emotionIntensity: topHume.score,
    isUncertain,
    uncertaintyOptions,
  };
};

// Resolves { emotions, mocked }. `mocked: true` marks a FREE random fallback so
// callers never let it override the reliable text-based signal.
const analyzeEmotion = (audioBuffer) => {
  return new Promise((resolve) => {
    const keyMissing =
      !process.env.HUME_API_KEY ||
      process.env.HUME_API_KEY.includes('dummy') ||
      process.env.HUME_API_KEY.includes('[paste') ||
      process.env.HUME_API_KEY.trim() === '';

    // No key → run the FREE mock. Zero spend.
    if (keyMissing) {
      console.log('[Hume][FREE MOCK] No API key — generating mock emotions (zero spend).');
      setTimeout(() => resolve({ emotions: mockEmotions(), mocked: true }), 800);
      return;
    }

    // ── PAID: Hume AI prosody model (free tier has limited credits) ──
    trackHume();
    const ws = new WebSocket(`wss://api.hume.ai/v0/stream/models?apikey=${process.env.HUME_API_KEY}`);

    // Any failure degrades to the FREE mock so the demo keeps working.
    const degrade = (reason) => {
      console.warn(`[Hume] ${reason} — falling back to FREE mock emotions (no upgrade, zero spend).`);
      resolve({ emotions: mockEmotions(), mocked: true });
    };

    const timeout = setTimeout(() => {
      ws.close();
      degrade('Timeout after 8s');
    }, 8000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        data: audioBuffer.toString('base64'),
        models: { prosody: {} },
      }));
    });

    ws.on('message', (data) => {
      clearTimeout(timeout);
      try {
        const response = JSON.parse(data);
        if (response.prosody?.predictions?.length > 0) {
          ws.close();
          resolve({ emotions: response.prosody.predictions[0].emotions, mocked: false });
        } else {
          ws.close();
          degrade('Empty prosody prediction');
        }
      } catch (err) {
        ws.close();
        degrade(`Parse error: ${err.message}`);
      }
    });

    ws.on('unexpected-response', (req, res) => {
      clearTimeout(timeout);
      // 401/402/429 here typically means a key/quota/free-tier limit.
      degrade(`HTTP ${res.statusCode} (likely free-tier or auth limit)`);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      degrade(`WebSocket error: ${err.message}`);
    });
  });
};

const neutralResult = (text) => ({
  emotion: 'neutral',
  emotionIntensity: 0,
  segments: text && text.trim() ? [{ text: text.trim(), emotion: 'neutral', emotionIntensity: 0 }] : [],
  emotions: [],
  isMixed: false,
  isUncertain: false,
  uncertaintyOptions: null,
});

// POST /api/voice/analyze
// Emotion for a VOICE message. The transcript (free Web Speech text) is the
// PRIMARY, reliable signal — it understands the words and supports multiple
// emotions per message. Hume prosody (voice tone) is consulted only when the
// text is neutral AND a real (non-mock) result is available — the random mock
// can never override the text. Transcription itself is NOT done here.
export const analyzeVoice = async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    let result = text ? analyzeText(text) : null;

    // Only reach for voice-tone when the words gave us nothing.
    if ((!result || result.emotion === 'neutral') && req.file) {
      const { emotions, mocked } = await analyzeEmotion(req.file.buffer);
      if (!mocked && emotions?.length) {
        const mapped = mapHumeToVybe(emotions);
        if (mapped.emotion !== 'neutral') {
          result = {
            ...mapped,
            segments: text ? [{ text, emotion: mapped.emotion, emotionIntensity: mapped.emotionIntensity }] : [],
            emotions: [mapped.emotion],
            isMixed: false,
          };
        }
      }
    }

    res.status(200).json(result || neutralResult(text));
  } catch (error) {
    console.error('Emotion analysis error:', error);
    // Never block sending a message — degrade silently to neutral.
    res.status(200).json(neutralResult((req.body?.text || '').trim()));
  }
};

// POST /api/voice/analyze-text
// Emotion for a TYPED message — free, local, no audio. Returns the same shape
// as /analyze (dominant emotion + per-sentence segments + mixed flag).
export const analyzeMessageText = (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(200).json(neutralResult(''));
  res.status(200).json(analyzeText(text));
};

// POST /api/voice/synthesize
// PAID: ElevenLabs voice playback. On any failure (missing key / quota /
// rate-limit) we respond 503 with { fallback: 'browser-tts' } and the client
// plays the message using the FREE browser SpeechSynthesis voice instead.
export const synthesizeAudio = async (req, res) => {
  try {
    const { text, emotion, voiceCloneId } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'No text provided for synthesis' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey.includes('dummy') || apiKey.trim() === '') {
      console.warn('[ElevenLabs][FREE FALLBACK] No API key — client will use free browser TTS.');
      return res.status(503).json({ fallback: 'browser-tts', message: 'Voice clone unavailable (no key)' });
    }

    // Default expressive voice (works on the ElevenLabs free tier). In production
    // this is the user's own cloned voice (message.sender.voiceCloneId).
    const voiceId = voiceCloneId || 'CwhRBWXzGAHq8TQ4Fs17';
    const settings = EMOTION_VOICE_SETTINGS[emotion] || EMOTION_VOICE_SETTINGS['neutral'];

    trackElevenLabs(text.length);

    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      data: {
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarity_boost,
          style: settings.style,
          use_speaker_boost: true,
        },
      },
      responseType: 'stream',
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);
  } catch (error) {
    const status = error.response?.status;
    console.warn(
      `[ElevenLabs] Synthesis failed (status ${status ?? 'n/a'}) — ` +
      `no upgrade; client falls back to FREE browser TTS.`
    );

    // Surface ElevenLabs' error body when it's a stream (helps spot quota hits).
    if (error.response?.data && typeof error.response.data.on === 'function') {
      let body = '';
      error.response.data.on('data', (chunk) => { body += chunk.toString(); });
      error.response.data.on('end', () => console.warn('[ElevenLabs] error body:', body));
    }

    if (!res.headersSent) {
      res.status(503).json({ fallback: 'browser-tts', message: 'Voice synthesis unavailable' });
    } else {
      res.end();
    }
  }
};

// GET /api/voice/usage — dev helper to inspect paid-API usage this run.
export const getUsageStats = (req, res) => {
  res.status(200).json(getUsage());
};
