import WebSocket from 'ws';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { EMOTION_VOICE_SETTINGS } from '../constants/emotionVoiceSettings.js';
import { trackHume, trackElevenLabs, getUsage } from '../utils/usageTracker.js';
import { analyzeText } from '../utils/emotionAnalyzer.js';
import { detectVoiceEmotion } from '../utils/voiceEmotion.js';
import {
  resolveReference,
  cloneViaService,
  generateAndCache,
  getCachedPath,
  isValidMessageId,
} from '../utils/ttsCloneService.js';
import { enqueueClone } from '../utils/ttsQueue.js';

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
// Emotion for a VOICE message, from two signals:
//   - WORDS: free local text analysis (supports the 7 emotions + mixed).
//   - TONE:  free local Speech Emotion Recognition on the recording (neu/happy/
//            angry/sad) — catches an angry/sad delivery even with neutral words.
// Tone LEADS when the words are flat (low bar) or when it's strongly confident
// (high bar), otherwise the richer text result wins. Transcription is NOT done
// here, and the raw recording is discarded after analysis (BRIEF §3B.6 / §4).
export const analyzeVoice = async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    let result = text ? analyzeText(text) : null;

    if (req.file?.buffer?.length) {
      const voice = await detectVoiceEmotion(req.file.buffer);
      if (voice && voice.emotion !== 'neutral') {
        const textNeutral = !result || result.emotion === 'neutral';
        // Low bar to fill a neutral guess; high bar to override a confident text guess.
        const strongEnough = textNeutral ? voice.score >= 0.4 : voice.score >= 0.65;
        if (strongEnough) {
          const intensity = Number(voice.score.toFixed(2));
          result = {
            emotion: voice.emotion,
            emotionIntensity: intensity,
            segments: text ? [{ text, emotion: voice.emotion, emotionIntensity: intensity }] : [],
            emotions: [voice.emotion],
            isMixed: false,
            isUncertain: false,
            uncertaintyOptions: null,
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
// Voice playback, in order of preference:
//   1. FREE self-hosted XTTS clone (VOICE_CLONE_URL) — the sender's OWN voice.
//      Serves the pre-generated disk cache instantly when ready; otherwise
//      generates now (reusing any in-flight pre-gen job for this message).
//   2. PAID ElevenLabs (default voice) when a key is set.
//   3. 503 { fallback: 'browser-tts' } → client uses the free browser voice.
// Each tier degrades gracefully to the next, so playback never hard-fails.
export const synthesizeAudio = async (req, res) => {
  try {
    const { text, emotion, voiceCloneId, senderId, messageId } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'No text provided for synthesis' });
    }

    // ── 1. FREE self-hosted voice clone (XTTS) — the real "sender's voice" ──
    const cloneUrl = process.env.VOICE_CLONE_URL;
    if (cloneUrl) {
      try {
        // Instant path: serve the pre-generated cache if it's ready.
        const cached = await getCachedPath(messageId);
        if (cached) {
          res.setHeader('Content-Type', 'audio/wav');
          return res.sendFile(cached);
        }

        // Not cached yet — generate now, reusing an in-flight pre-gen job if one
        // exists (so we never clone the same message twice concurrently).
        if (isValidMessageId(messageId)) {
          const out = await enqueueClone(messageId, () =>
            generateAndCache({ messageId, text, senderId, emotion })
          );
          res.setHeader('Content-Type', 'audio/wav');
          return res.sendFile(out);
        }

        // No messageId (unexpected) — one-off clone without caching.
        const refPath = await resolveReference({ senderId });
        if (refPath) {
          const wav = await cloneViaService({ text, refPath, emotion });
          res.setHeader('Content-Type', 'audio/wav');
          return res.send(wav);
        }
        console.warn('[VoiceClone] no reference — falling back.');
      } catch (err) {
        console.warn(`[VoiceClone] XTTS unavailable (${err.message}) — falling back.`);
      }
    }

    // ── 2. PAID ElevenLabs (shared default voice) ──
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
