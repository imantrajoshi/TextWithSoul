import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import { transcribeAudio, synthesizeAudio } from '../controllers/voiceController.js';

const router = express.Router();

// Configure multer to store file in memory with a 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max limit
  },
});

// Protect the route so only authenticated users can transcribe
router.post('/transcribe', auth, upload.single('audio'), transcribeAudio);

// Add the synthesize route for Phase 5
router.post('/synthesize', auth, express.json(), synthesizeAudio);

export default router;
