import { motion } from 'motion/react';

export default function TypingIndicator({ userName }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="flex items-center gap-2 px-4 py-2"
    >
      <div className="bg-received px-4 py-3 rounded-2xl rounded-bl-md border border-border-subtle">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 bg-text-tertiary rounded-full"
                animate={{
                  y: [0, -4, 0],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-text-tertiary ml-1">
            {userName} is typing
          </span>
        </div>
      </div>
    </motion.div>
  );
}
