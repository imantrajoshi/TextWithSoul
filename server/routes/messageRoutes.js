import express from 'express';
import { getMessages } from '../controllers/messageController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/:conversationId', getMessages);

export default router;
