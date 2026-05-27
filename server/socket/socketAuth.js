import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication error — no token'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select(
      '_id displayName phoneNumber profilePhoto isOnline'
    );

    if (!user) {
      return next(new Error('Authentication error — user not found'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error — invalid token'));
  }
};

export default socketAuth;
