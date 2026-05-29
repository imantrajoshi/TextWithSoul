import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import { analyzeVoice, analyzeMessageText, synthesizeAudio, getUsageStats } from '../controllers/voiceController.js';
import { enrollSample, completeEnrollment } from '../controllers/enrollmentController.js';

const router = express.Router();

// Store the uploaded audio in memory, 10MB max.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Emotion analysis for a VOICE message (audio + free Web Speech transcript).
// Text is the primary signal; transcription is handled client-side for free.
router.post('/analyze', auth, upload.single('audio'), analyzeVoice);

// Emotion analysis for a TYPED message — free, local, no audio.
router.post('/analyze-text', auth, express.json(), analyzeMessageText);

// PAID: ElevenLabs voice playback. Degrades to free browser TTS on the client.
router.post('/synthesize', auth, express.json(), synthesizeAudio);

// Voice-clone enrollment (free plumbing — stores one audio sample per emotion).
router.post('/enroll/sample', auth, upload.single('audio'), enrollSample);
router.post('/enroll/complete', auth, completeEnrollment);

// Dev helper: inspect cumulative paid-API usage for this server run.
router.get('/usage', auth, getUsageStats);

export default router;
