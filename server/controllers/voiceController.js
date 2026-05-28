import OpenAI from 'openai';
import { toFile } from 'openai';
import WebSocket from 'ws';
import axios from 'axios';
import { EMOTION_VOICE_SETTINGS } from '../constants/emotionVoiceSettings.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_prevent_startup_crash',
});

// Hume to Vybe Mapping
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

const mapHumeToVybe = (humeEmotions) => {
  if (!humeEmotions || humeEmotions.length === 0) {
    return { emotion: 'neutral', emotionIntensity: 0, isUncertain: false, uncertaintyOptions: null };
  }

  // Sort descending by score
  const sorted = [...humeEmotions].sort((a, b) => b.score - a.score);

  const topHume = sorted[0];
  const secondHume = sorted[1];

  let topTag = EMOTION_MAP[topHume.name] || 'neutral';
  let secondTag = secondHume ? (EMOTION_MAP[secondHume.name] || 'neutral') : 'neutral';

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

const analyzeEmotion = (audioBuffer) => {
  return new Promise((resolve) => {
    // If Hume API key is missing, mock the emotion detection for testing
    if (!process.env.HUME_API_KEY || process.env.HUME_API_KEY.includes('dummy') || process.env.HUME_API_KEY.includes('[paste') || process.env.HUME_API_KEY.trim() === '') {
      console.log('⚠ HUME_API_KEY is missing. Mocking emotion data...');
      setTimeout(() => {
        // Randomly simulate different states for UI testing:
        const rand = Math.random();
        if (rand < 0.33) {
          // 33% chance: Clear winner (Excited)
          resolve([{ name: 'Joy', score: 0.9 }]);
        } else if (rand < 0.66) {
          // 33% chance: Clear winner (Angry)
          resolve([{ name: 'Anger', score: 0.85 }]);
        } else {
          // 34% chance: Uncertainty (scores within 0.15)
          resolve([
            { name: 'Joy', score: 0.85 },
            { name: 'Sadness', score: 0.80 }
          ]);
        }
      }, 1000);
      return;
    }

    const ws = new WebSocket(`wss://api.hume.ai/v0/stream/models?apikey=${process.env.HUME_API_KEY}`);

    const timeout = setTimeout(() => {
      ws.close();
      resolve(null);
    }, 8000); // 8 second timeout for Hume

    ws.on('open', () => {
      const base64Audio = audioBuffer.toString('base64');
      ws.send(JSON.stringify({
        data: base64Audio,
        models: {
          prosody: {}
        }
      }));
    });

    ws.on('message', (data) => {
      clearTimeout(timeout);
      try {
        const response = JSON.parse(data);
        if (response.prosody && response.prosody.predictions && response.prosody.predictions.length > 0) {
          const emotions = response.prosody.predictions[0].emotions;
          ws.close();
          resolve(emotions);
        } else {
          ws.close();
          resolve(null);
        }
      } catch (err) {
        console.error('Hume parse error:', err);
        ws.close();
        resolve(null);
      }
    });

    ws.on('unexpected-response', (req, res) => {
      console.error(`Hume WS Unexpected Response: ${res.statusCode}`);
      clearTimeout(timeout);
      resolve(null);
    });

    ws.on('error', (err) => {
      console.error('Hume WS Error:', err);
      clearTimeout(timeout);
      resolve(null);
    });
  });
};

export const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    // Run Whisper and Hume in parallel
    const audioBuffer = req.file.buffer;
    
    // If OpenAI API key is missing, mock the transcription
    let whisperPromise;
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('dummy') || process.env.OPENAI_API_KEY.trim() === '') {
      console.log('⚠ OPENAI_API_KEY is missing. Mocking transcription...');
      whisperPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({ text: "This is a mocked transcription because the OpenAI API key was not provided. It works perfectly!" });
        }, 1500);
      });
    } else {
      whisperPromise = openai.audio.transcriptions.create({
        file: await toFile(audioBuffer, 'audio.webm', { type: 'audio/webm' }),
        model: 'whisper-1',
      });
    }

    const humePromise = analyzeEmotion(audioBuffer);

    const [transcription, humeEmotions] = await Promise.all([whisperPromise, humePromise]);

    const emotionData = mapHumeToVybe(humeEmotions);

    res.status(200).json({
      text: transcription.text.trim(),
      ...emotionData,
    });
  } catch (error) {
    console.error('Transcription/Emotion error:', error);
    res.status(500).json({ message: "Couldn't process audio. Try again or type instead." });
  }
};

export const synthesizeAudio = async (req, res) => {
  try {
    const { text, emotion, voiceCloneId } = req.body;
    
    if (!text) {
      return res.status(400).json({ message: 'No text provided for synthesis' });
    }

    // ElevenLabs API Key check
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey.includes('dummy') || apiKey.trim() === '') {
      console.error('ELEVENLABS_API_KEY is missing');
      return res.status(500).json({ message: 'ElevenLabs API key is missing' });
    }

    // Default Voice ID if voiceCloneId is not provided (Phase 5 Option A)
    // Using Roger as the default expressive voice because it works on the Free Tier API
    const voiceId = voiceCloneId || 'CwhRBWXzGAHq8TQ4Fs17'; 

    const settings = EMOTION_VOICE_SETTINGS[emotion] || EMOTION_VOICE_SETTINGS['neutral'];

    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        text: text,
        model_id: 'eleven_turbo_v2', // Faster model for real-time
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarity_boost,
          style: settings.style,
          use_speaker_boost: true
        }
      },
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);

  } catch (error) {
    if (error.response && error.response.data && typeof error.response.data.on === 'function') {
      let errorBody = '';
      error.response.data.on('data', chunk => {
        errorBody += chunk.toString();
      });
      error.response.data.on('end', () => {
        console.error('ElevenLabs API Error (Stream):', errorBody);
      });
    } else {
      console.error('Synthesis error:', error.response ? error.response.data : error.message);
    }
    res.status(500).json({ message: 'Audio synthesis failed' });
  }
};
