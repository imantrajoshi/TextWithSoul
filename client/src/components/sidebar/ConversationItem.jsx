import { motion } from 'motion/react';
import UserAvatar from './UserAvatar';
import { formatTime, formatDate, getOtherParticipant } from '../../utils/helpers';

export default function ConversationItem({
  conversation,
  currentUserId,
  isActive,
  onClick,
}) {
  const other = getOtherParticipant(conversation.participants, currentUserId);
  const lastMsg = conversation.lastMessage;
  const hasLastMessage = lastMsg && lastMsg.text;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.15 }}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl
        transition-all duration-150 text-left cursor-pointer
        ${
          isActive
            ? 'bg-accent-subtle border border-accent/10'
            : 'hover:bg-bg-tertiary/50 border border-transparent'
        }
      `}
    >
      <UserAvatar user={other} size="md" showOnline />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-sm font-medium truncate ${
              isActive ? 'text-accent' : 'text-text-primary'
            }`}
          >
            {other?.displayName || 'Unknown'}
          </span>
          {hasLastMessage && (
            <span className="text-xs text-text-tertiary shrink-0 ml-2">
              {formatTime(lastMsg.createdAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary truncate mt-0.5">
          {hasLastMessage
            ? lastMsg.text
            : 'No messages yet'}
        </p>
      </div>
    </motion.button>
  );
}
