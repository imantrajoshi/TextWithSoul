import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { analyzeText } from '../utils/emotionAnalyzer.js';
import { resolveReference, generateAndCache } from '../utils/ttsCloneService.js';
import { enqueueClone } from '../utils/ttsQueue.js';

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

const socketHandler = (io) => {
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`⚡ User connected: ${socket.user.displayName || userId}`);

    // Track socket for this user (supports multiple tabs)
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Set user online
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // Join personal room for direct notifications
    socket.join(`user:${userId}`);

    // Broadcast online status to all connected clients
    io.emit('user:status', { userId, isOnline: true });

    // --- Event Handlers ---

    // Join a conversation room
    socket.on('conversation:join', ({ conversationId }) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    // Leave a conversation room
    socket.on('conversation:leave', ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // Send a message
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, text, emotion, emotionIntensity, voiceClipId } = data;

        if (!conversationId || !text || !text.trim()) return;

        // Verify user is participant
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });

        if (!conversation) return;

        // Emotion is resolved AUTHORITATIVELY on the server so every message gets
        // emotion + per-sentence segments regardless of client timing (e.g. a typed
        // message sent before the client's debounced preview finished).
        const ALLOWED_EMOTIONS = ['excited', 'happy', 'sad', 'angry', 'anxious', 'loving', 'neutral'];
        const analysis = analyzeText(text);
        let resolvedEmotion = analysis.emotion;
        let resolvedIntensity = analysis.emotionIntensity;
        let resolvedSegments = analysis.segments;

        // If the words were neutral but the client detected something (e.g. voice
        // tone from Hume prosody), honour the client's hint.
        if (
          resolvedEmotion === 'neutral' &&
          ALLOWED_EMOTIONS.includes(emotion) &&
          emotion !== 'neutral'
        ) {
          resolvedEmotion = emotion;
          resolvedIntensity = typeof emotionIntensity === 'number' ? emotionIntensity : 0;
          resolvedSegments = [{ text: text.trim(), emotion: resolvedEmotion, emotionIntensity: resolvedIntensity }];
        }

        // Voice-message recording id (uuid), for cloning playback from the
        // actual recording. Validated to prevent path traversal.
        const safeVoiceClipId =
          typeof voiceClipId === 'string' && /^[0-9a-f-]{36}$/i.test(voiceClipId) ? voiceClipId : '';

        // Create message
        const message = await Message.create({
          conversationId,
          senderId: userId,
          text: text.trim(),
          emotion: resolvedEmotion,
          emotionIntensity: resolvedIntensity,
          segments: resolvedSegments,
          voiceClipId: safeVoiceClipId,
          readBy: [userId],
        });

        // Populate sender info
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', '_id displayName profilePhoto')
          .lean();

        // Update conversation's last message
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: {
            text: text.trim(),
            senderId: userId,
            emotion: resolvedEmotion,
            createdAt: message.createdAt,
          },
        });

        // Decide whether this message will be voice-cloned, so the UI can show a
        // "preparing → ready" cue. Eligible = clone service on, NOT mixed-emotion
        // (those play via browser TTS), and the sender has a usable reference clip.
        const distinctEmotions = new Set(
          (resolvedSegments || []).map((s) => s.emotion).filter((e) => e && e !== 'neutral')
        );
        const isMixed = distinctEmotions.size >= 2;
        let cloneEligible = false;
        if (process.env.VOICE_CLONE_URL && !isMixed) {
          const ref = await resolveReference({ senderId: userId, voiceClipId: safeVoiceClipId });
          cloneEligible = !!ref;
        }
        populatedMessage.cloneEligible = cloneEligible;

        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit('message:received', {
          message: populatedMessage,
        });

        // PRE-GENERATION: clone the audio in the background now so the receiver's
        // first tap is instant. Non-blocking; emits 'audio:ready' when cached.
        if (cloneEligible) {
          const mid = String(message._id);
          enqueueClone(mid, () =>
            generateAndCache({
              messageId: mid,
              text: text.trim(),
              senderId: userId,
              emotion: resolvedEmotion,
              voiceClipId: safeVoiceClipId,
            })
          )
            .then(() => {
              io.to(`conversation:${conversationId}`).emit('audio:ready', {
                messageId: mid,
                conversationId,
              });
            })
            .catch((e) => console.warn('[PreGen] failed for', mid, '-', e.message));
        }

        // Also notify participants who aren't in the conversation room
        // (so their sidebar updates)
        const otherParticipants = conversation.participants.filter(
          (p) => p.toString() !== userId
        );

        for (const participantId of otherParticipants) {
          io.to(`user:${participantId}`).emit('conversation:updated', {
            conversationId,
            lastMessage: {
              text: text.trim(),
              senderId: userId,
              emotion: resolvedEmotion,
              createdAt: message.createdAt,
            },
          });
        }
      } catch (error) {
        console.error('Socket message:send error:', error.message);
      }
    });

    // Typing indicators
    socket.on('typing:start', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          userId,
          conversationId,
          isTyping: true,
        });
      }
    });

    socket.on('typing:stop', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          userId,
          conversationId,
          isTyping: false,
        });
      }
    });

    // Mark messages as read
    socket.on('message:read', async ({ conversationId }) => {
      try {
        if (!conversationId) return;

        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: userId },
            readBy: { $ne: userId },
          },
          { $push: { readBy: userId } }
        );
      } catch (error) {
        console.error('Socket message:read error:', error.message);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`⚡ User disconnected: ${socket.user.displayName || userId}`);

      // Remove this socket from tracking
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // Only set offline if no more tabs open
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
          io.emit('user:status', { userId, isOnline: false });
        }
      }
    });
  });
};

export default socketHandler;
