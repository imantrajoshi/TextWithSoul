import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';

// @desc    Get messages for a conversation (skip/limit pagination)
// @route   GET /api/messages/:conversationId?page=1&limit=50
export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

    // Verify user is participant in this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const skip = (page - 1) * limit;

    const totalMessages = await Message.countDocuments({ conversationId });

    // Get messages sorted oldest-first for display, but paginate from newest
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', '_id displayName profilePhoto')
      .lean();

    // Reverse to display in chronological order
    messages.reverse();

    res.status(200).json({
      messages,
      pagination: {
        page,
        limit,
        total: totalMessages,
        totalPages: Math.ceil(totalMessages / limit),
        hasMore: skip + limit < totalMessages,
      },
    });
  } catch (error) {
    next(error);
  }
};
