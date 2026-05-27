import express from 'express';
import rateLimit from 'express-rate-limit';
import { sendOTP, verifyOTP, setupProfile, getMe } from '../controllers/authController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Rate limit OTP requests: max 5 per 15 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many OTP requests — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/send-otp', otpLimiter, sendOTP);
router.post('/verify-otp', verifyOTP);
router.patch('/setup-profile', auth, setupProfile);
router.get('/me', auth, getMe);

export default router;
