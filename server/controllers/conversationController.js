import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

// @desc    Get all conversations for current user
// @route   GET /api/conversations
export const getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', '_id displayName phoneNumber profilePhoto isOnline lastSeen')
      .sort({ 'lastMessage.createdAt': -1 });

    res.status(200).json({ conversations });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or get existing conversation with another user
// @route   POST /api/conversations
export const createConversation = async (req, res, next) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    if (participantId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot start a conversation with yourself' });
    }

    // Check participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, participantId], $size: 2 },
    }).populate('participants', '_id displayName phoneNumber profilePhoto isOnline lastSeen');

    if (conversation) {
      return res.status(200).json({ conversation, isNew: false });
    }

    // Create new conversation
    conversation = await Conversation.create({
      participants: [req.user._id, participantId],
    });

    conversation = await Conversation.findById(conversation._id).populate(
      'participants',
      '_id displayName phoneNumber profilePhoto isOnline lastSeen'
    );

    res.status(201).json({ conversation, isNew: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single conversation
// @route   GET /api/conversations/:id
export const getConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
    }).populate('participants', '_id displayName phoneNumber profilePhoto isOnline lastSeen');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.status(200).json({ conversation });
  } catch (error) {
    next(error);
  }
};
