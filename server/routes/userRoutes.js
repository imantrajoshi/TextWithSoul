import express from 'express';
import { searchUsers, getProfile, updateProfile } from '../controllers/userController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth); // All user routes require authentication

router.get('/search', searchUsers);
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);

export default router;
