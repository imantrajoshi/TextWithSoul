import { motion } from 'motion/react';
import { formatTime } from '../../utils/helpers';

export default function MessageBubble({
  message,
  isMine,
  showAvatar = false,
  emotion = 'neutral',
  emotionIntensity = 0,
}) {
  // Phase 4 will use emotion + emotionIntensity to style the bubble.
  // For now, all messages render with neutral styling.

  // Phase 3 Emotion Verification Labels
  const getEmojiForEmotion = (emo) => {
    const map = { excited: '⚡', happy: '😊', sad: '💙', angry: '🔴', anxious: '😰', loving: '🌸', neutral: '' };
    return map[emo] || '';
  };

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} w-full mb-1`}>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}
      >
      <div
        className={`
          px-4 py-2.5 rounded-2xl break-words
          ${
            isMine
              ? 'bg-accent text-white rounded-br-sm shadow-sm'
              : 'bg-white border border-border-subtle text-text-primary rounded-bl-sm shadow-sm'
          }
        `}
      >
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.text}</p>
      </div>
      
      <div className={`flex items-center gap-2 mt-1.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        <span className="text-[11px] font-medium text-text-tertiary tracking-wide uppercase">
          {formatTime(message.createdAt)}
        </span>
        
        {/* Phase 3 Emotion Indicator (temporary for verification) */}
        {message.emotion && message.emotion !== 'neutral' && (
          <span className="text-[11px] font-medium text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded-full flex items-center gap-1 opacity-70">
            {getEmojiForEmotion(message.emotion)} {message.emotion}
          </span>
        )}
      </div>
    </motion.div>
    </div>
  );
}
