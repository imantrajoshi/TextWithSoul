import { motion } from 'motion/react';

// Shown after a VOICE note is recorded: lets the sender confirm (or correct) the
// emotion, since the words alone can miss how it was actually said — e.g. an
// angry tone with neutral words. The detected emotion is pre-highlighted; one
// tap keeps or changes it. The chosen emotion is sent as "confirmed" and drives
// both the bubble styling and the cloned-voice expressiveness.
const EMOTIONS = [
  { key: 'happy', emoji: '😊', label: 'Happy' },
  { key: 'excited', emoji: '⚡', label: 'Excited' },
  { key: 'loving', emoji: '🌸', label: 'Loving' },
  { key: 'sad', emoji: '💙', label: 'Sad' },
  { key: 'angry', emoji: '🔴', label: 'Angry' },
  { key: 'anxious', emoji: '😰', label: 'Anxious' },
  { key: 'neutral', emoji: '💬', label: 'Neutral' },
];

export default function EmotionConfirm({ detected, onSelect, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute bottom-full mb-3 left-4 right-4 z-20 bg-bg-elevated border border-border rounded-2xl p-4 shadow-lg glass"
    >
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-medium text-text-primary">
          How did you say it? <span className="text-text-tertiary">(tap to confirm)</span>
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-text-tertiary hover:text-text-primary p-1"
          aria-label="Keep detected emotion"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EMOTIONS.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => onSelect(e.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              e.key === detected
                ? 'bg-accent text-white shadow-sm'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'
            }`}
          >
            <span>{e.emoji}</span>
            <span>{e.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
