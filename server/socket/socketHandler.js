import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

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
        const { conversationId, text, emotion, emotionIntensity, segments } = data;

        if (!conversationId || !text || !text.trim()) return;

        // Verify user is participant
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });

        if (!conversation) return;

        // Resolve emotion — default to neutral if not provided
        const ALLOWED_EMOTIONS = ['excited', 'happy', 'sad', 'angry', 'anxious', 'loving', 'neutral'];
        const resolvedEmotion = ALLOWED_EMOTIONS.includes(emotion) ? emotion : 'neutral';
        const resolvedIntensity = typeof emotionIntensity === 'number' ? emotionIntensity : 0;

        // Sanitize per-sentence emotion breakdown (client-supplied).
        const resolvedSegments = Array.isArray(segments)
          ? segments.slice(0, 40).map((s) => ({
              text: typeof s?.text === 'string' ? s.text.slice(0, 1000) : '',
              emotion: ALLOWED_EMOTIONS.includes(s?.emotion) ? s.emotion : 'neutral',
              emotionIntensity:
                typeof s?.emotionIntensity === 'number'
                  ? Math.max(0, Math.min(1, s.emotionIntensity))
                  : 0,
            })).filter((s) => s.text)
          : [];

        // Create message
        const message = await Message.create({
          conversationId,
          senderId: userId,
          text: text.trim(),
          emotion: resolvedEmotion,
          emotionIntensity: resolvedIntensity,
          segments: resolvedSegments,
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

        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit('message:received', {
          message: populatedMessage,
        });

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
