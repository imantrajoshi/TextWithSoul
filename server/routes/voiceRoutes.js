import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import { analyzeVoice, synthesizeAudio, getUsageStats } from '../controllers/voiceController.js';

const router = express.Router();

// Store the uploaded audio in memory, 10MB max.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Emotion analysis from the recorded audio.
// (Transcription is handled client-side for free via the Web Speech API.)
router.post('/analyze', auth, upload.single('audio'), analyzeVoice);

// PAID: ElevenLabs voice playback. Degrades to free browser TTS on the client.
router.post('/synthesize', auth, express.json(), synthesizeAudio);

// Dev helper: inspect cumulative paid-API usage for this server run.
router.get('/usage', auth, getUsageStats);

export default router;
