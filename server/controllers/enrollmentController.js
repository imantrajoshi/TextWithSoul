import fs from 'fs/promises';
import path from 'path';
import User from '../models/User.js';

/*
 * Voice-clone enrollment (EXPERIMENTAL PROTOTYPE — zero spend).
 *
 * Captures a few short voice samples from the user, one per emotion, and stores
 * them on local disk. NO paid cloning API is called here — this is the free
 * "architecturally ready" plumbing. A later local XTTS service will read these
 * samples as voice references (the typed-message lane picks the sample matching
 * the detected emotion). See README → "Free Tier vs Production".
 */

// The product's emotion set. Used to validate input AND to sanitize the
// filename (emotion is part of the path), so only these literals are allowed.
const ALLOWED_EMOTIONS = ['neutral', 'happy', 'excited', 'sad', 'angry', 'anxious', 'loving'];

const samplesDir = (userId) =>
  path.join(process.cwd(), 'uploads', 'voice-samples', String(userId));

// POST /api/voice/enroll/sample  (multipart: audio + emotion)
export const enrollSample = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio sample provided' });
    }

    // Trust & Safety (PROJECT BRIEF §5): no voice cloning without explicit consent.
    if (!req.user?.voiceConsent?.agreed) {
      return res.status(403).json({ message: 'Voice cloning consent required' });
    }

    const emotion = (req.body.emotion || '').trim().toLowerCase();
    if (!ALLOWED_EMOTIONS.includes(emotion)) {
      return res.status(400).json({ message: `Invalid emotion: ${emotion}` });
    }

    const dir = samplesDir(req.user._id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${emotion}.webm`), req.file.buffer);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { enrolledEmotions: emotion } },
      { new: true }
    ).select('enrolledEmotions');

    res.status(200).json({ emotion, enrolledEmotions: user.enrolledEmotions });
  } catch (error) {
    console.error('Voice enroll error:', error);
    res.status(500).json({ message: 'Failed to save voice sample' });
  }
};

// POST /api/voice/enroll/complete — mark the user as voice-enrolled.
export const completeEnrollment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('enrolledEmotions');
    if (!user || user.enrolledEmotions.length === 0) {
      return res.status(400).json({ message: 'Record at least one voice sample first' });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { voiceEnrolled: true },
      { new: true }
    ).select('_id displayName voiceEnrolled enrolledEmotions');

    res.status(200).json({
      message: 'Voice enrollment complete',
      user: {
        _id: updated._id,
        displayName: updated.displayName,
        voiceEnrolled: updated.voiceEnrolled,
        enrolledEmotions: updated.enrolledEmotions,
      },
    });
  } catch (error) {
    console.error('Complete enrollment error:', error);
    res.status(500).json({ message: 'Failed to complete enrollment' });
  }
};
