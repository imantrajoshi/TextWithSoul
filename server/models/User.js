import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    displayName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    voiceCloneId: {
      type: String,
      default: null,
    },
    voiceEnrolled: {
      type: Boolean,
      default: false,
    },
    // Emotions the user has recorded a voice sample for (powers the typed lane:
    // typed message → detected emotion → matching sample drives the clone).
    enrolledEmotions: {
      type: [String],
      default: [],
    },
    // Trust & Safety (PROJECT BRIEF §5): explicit consent must be given before
    // we record/clone the user's voice. Required before any enrollment sample.
    voiceConsent: {
      agreed: { type: Boolean, default: false },
      agreedAt: { type: Date, default: null },
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ displayName: 'text' });

const User = mongoose.model('User', userSchema);

export default User;
