import { motion } from 'motion/react';

export default function UncertaintyPopup({ options, onSelect, onDismiss }) {
  if (!options || options.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute bottom-full mb-3 left-4 right-4 z-20 bg-bg-elevated border border-border rounded-2xl p-4 shadow-lg flex flex-col items-center glass"
    >
      <div className="flex justify-between w-full mb-3 items-center">
        <p className="text-sm font-medium text-text-primary text-center flex-1">
          We sensed <span className="font-bold capitalize">{options[0]}</span> or <span className="font-bold capitalize">{options[1]}</span> — which fits?
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-text-tertiary hover:text-text-primary p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      
      <div className="flex gap-3 w-full">
        <button
          type="button"
          onClick={() => onSelect(options[0])}
          className="flex-1 bg-accent-subtle hover:bg-accent text-accent hover:text-white transition-colors py-2 rounded-xl text-sm font-semibold capitalize"
        >
          {options[0]}
        </button>
        <button
          type="button"
          onClick={() => onSelect(options[1])}
          className="flex-1 bg-bg-tertiary hover:bg-text-secondary text-text-secondary hover:text-white transition-colors py-2 rounded-xl text-sm font-semibold capitalize"
        >
          {options[1]}
        </button>
      </div>
    </motion.div>
  );
}
