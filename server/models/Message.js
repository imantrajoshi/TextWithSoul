import mongoose from 'mongoose';

const EMOTION_ENUM = ['excited', 'happy', 'sad', 'angry', 'anxious', 'loving', 'neutral'];

// A message can carry MULTIPLE emotions — one per sentence/clause. Each segment
// keeps its own text, emotion and intensity so the UI can render and voice it
// sentence-by-sentence.
const segmentSchema = new mongoose.Schema(
  {
    text: { type: String, default: '' },
    emotion: { type: String, enum: EMOTION_ENUM, default: 'neutral' },
    emotionIntensity: { type: Number, min: 0, max: 1, default: 0 },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      maxlength: 5000,
    },
    emotion: {
      type: String,
      enum: EMOTION_ENUM,
      default: 'neutral',
    },
    emotionIntensity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    // Per-sentence emotion breakdown (empty for single-emotion messages).
    segments: {
      type: [segmentSchema],
      default: [],
    },
    // For VOICE messages: the stored recording (under uploads/voice-messages/
    // <senderId>/<voiceClipId>.webm) used as the clone reference at playback,
    // so it carries the exact emotion of how the sender actually said it.
    voiceClipId: {
      type: String,
      default: '',
    },
    audioProcessed: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
