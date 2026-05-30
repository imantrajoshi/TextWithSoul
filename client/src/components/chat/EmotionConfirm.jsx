import { useState } from 'react';
import { motion } from 'motion/react';

// Shown after a VOICE note is recorded: the sender confirms (or corrects) the
// emotion(s). MULTI-SELECT — tap to toggle one or more, then Confirm.
// Detected emotion(s) are pre-selected; the X dismisses without confirming and
// keeps the auto-detected result (text analysis).
const EMOTIONS = [
  { key: 'happy', emoji: '😊', label: 'Happy' },
  { key: 'excited', emoji: '⚡', label: 'Excited' },
  { key: 'loving', emoji: '🌸', label: 'Loving' },
  { key: 'sad', emoji: '💙', label: 'Sad' },
  { key: 'angry', emoji: '🔴', label: 'Angry' },
  { key: 'anxious', emoji: '😰', label: 'Anxious' },
  { key: 'neutral', emoji: '💬', label: 'Neutral' },
];

export default function EmotionConfirm({ detected, isMixed = false, emotions = [], onConfirm, onDismiss }) {
  const initial = () => {
    if (isMixed && emotions.length > 0) return new Set(emotions);
    if (detected) return new Set([detected]);
    return new Set();
  };
  const [selected, setSelected] = useState(initial);

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onConfirm([...selected]);
  };

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
          How did you say it? <span className="text-text-tertiary">(tap one or more)</span>
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

      <div className="flex flex-wrap gap-2 mb-3">
        {EMOTIONS.map((e) => {
          const isSelected = selected.has(e.key);
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => toggle(e.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'
              }`}
            >
              <span>{e.emoji}</span>
              <span>{e.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-accent text-white hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm{selected.size > 1 ? ` (${selected.size})` : ''}
        </button>
      </div>
    </motion.div>
  );
}
