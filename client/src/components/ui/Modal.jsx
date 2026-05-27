import { motion, AnimatePresence } from 'motion/react';

export default function Modal({ isOpen, onClose, title, children, className = '' }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`
              fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[90%] max-w-md
              glass rounded-2xl p-6
              shadow-lg z-50
              ${className}
            `}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold font-display">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-bg-tertiary cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {/* Content */}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
