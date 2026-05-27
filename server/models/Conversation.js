import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      text: { type: String, default: '' },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      emotion: {
        type: String,
        enum: ['excited', 'happy', 'sad', 'angry', 'anxious', 'loving', 'neutral'],
        default: 'neutral',
      },
      createdAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ 'lastMessage.createdAt': -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
