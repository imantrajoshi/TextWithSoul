import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import { transcribeAudio } from '../controllers/voiceController.js';

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

export default router;
