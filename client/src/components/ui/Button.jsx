import { motion } from 'motion/react';

const variants = {
  primary:
    'bg-accent text-text-inverse font-semibold hover:bg-accent-hover shadow-sm hover:shadow-glow',
  secondary:
    'bg-bg-tertiary text-text-primary border border-border hover:bg-bg-elevated hover:border-accent/30',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary',
  danger: 'bg-danger text-white font-semibold hover:bg-danger/80',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3 text-base rounded-xl',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      className={`
        inline-flex items-center justify-center gap-2
        font-sans
        transition-all duration-[var(--transition-fast)]
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </motion.button>
  );
}
