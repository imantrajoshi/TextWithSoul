import express from 'express';
import {
  getConversations,
  createConversation,
  getConversation,
} from '../controllers/conversationController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/', getConversations);
router.post('/', createConversation);
router.get('/:id', getConversation);

export default router;
