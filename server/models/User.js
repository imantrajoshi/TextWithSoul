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
