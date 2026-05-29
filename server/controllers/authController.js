import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

// In-memory OTP store: Map<phoneNumber, { otp, expiresAt }>
const otpStore = new Map();

const MOCK_OTP = '1111';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// @desc    Send OTP to phone number
// @route   POST /api/auth/send-otp
export const sendOTP = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return res.status(400).json({ message: 'Valid phone number is required' });
    }

    const cleanPhone = phoneNumber.trim();

    // Store mock OTP
    otpStore.set(cleanPhone, {
      otp: MOCK_OTP,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
    });

    console.log(`\n📱 [${process.env.APP_NAME}] OTP for ${cleanPhone}: ${MOCK_OTP}\n`);

    res.status(200).json({
      message: 'OTP sent successfully',
      // Include OTP in dev mode for easier testing
      ...(process.env.NODE_ENV === 'development' && { otp: MOCK_OTP }),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and login/register
// @route   POST /api/auth/verify-otp
export const verifyOTP = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const cleanPhone = phoneNumber.trim();
    const storedOTP = otpStore.get(cleanPhone);

    if (!storedOTP) {
      return res.status(400).json({ message: 'OTP not found — request a new one' });
    }

    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(cleanPhone);
      return res.status(400).json({ message: 'OTP has expired — request a new one' });
    }

    if (storedOTP.otp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP valid — clean up
    otpStore.delete(cleanPhone);

    // Find or create user
    let user = await User.findOne({ phoneNumber: cleanPhone });
    let isNewUser = false;

    if (!user) {
      user = await User.create({ phoneNumber: cleanPhone });
      isNewUser = true;
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      token,
      user: {
        _id: user._id,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
        voiceEnrolled: user.voiceEnrolled,
      },
      isNewUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Setup user profile (display name)
// @route   PATCH /api/auth/setup-profile
export const setupProfile = async (req, res, next) => {
  try {
    const { displayName } = req.body;

    if (!displayName || displayName.trim().length < 2) {
      return res.status(400).json({ message: 'Display name must be at least 2 characters' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { displayName: displayName.trim() },
      { new: true, runValidators: true }
    ).select('-__v');

    res.status(200).json({
      message: 'Profile updated',
      user: {
        _id: user._id,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
        voiceEnrolled: user.voiceEnrolled,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current authenticated user
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
  res.status(200).json({
    user: {
      _id: req.user._id,
      phoneNumber: req.user.phoneNumber,
      displayName: req.user.displayName,
      profilePhoto: req.user.profilePhoto,
      voiceEnrolled: req.user.voiceEnrolled,
      isOnline: req.user.isOnline,
    },
  });
};
