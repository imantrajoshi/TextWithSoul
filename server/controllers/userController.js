import User from '../models/User.js';

// @desc    Search users by phone number or display name
// @route   GET /api/users/search?q=
export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const query = q.trim();

    // Search by phone number or display name (case-insensitive)
    const users = await User.find({
      _id: { $ne: req.user._id }, // exclude self
      $or: [
        { phoneNumber: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } },
      ],
    })
      .select('_id phoneNumber displayName profilePhoto isOnline lastSeen')
      .limit(20);

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get own profile
// @route   GET /api/users/profile
export const getProfile = async (req, res) => {
  res.status(200).json({
    user: {
      _id: req.user._id,
      phoneNumber: req.user.phoneNumber,
      displayName: req.user.displayName,
      profilePhoto: req.user.profilePhoto,
      voiceEnrolled: req.user.voiceEnrolled,
      isOnline: req.user.isOnline,
      lastSeen: req.user.lastSeen,
    },
  });
};

// @desc    Update profile
// @route   PATCH /api/users/profile
export const updateProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['displayName', 'profilePhoto'];
    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-__v');

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
