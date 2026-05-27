import { forwardRef } from 'react';

const Input = forwardRef(
  ({ label, error, icon, className = '', containerClassName = '', ...props }, ref) => {
    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label className="block text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={`
              w-full px-4 py-3 
              bg-bg-tertiary text-text-primary
              border border-border rounded-xl
              text-sm font-sans
              placeholder:text-text-tertiary
              focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
              transition-all duration-[var(--transition-fast)]
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-danger/50 focus:border-danger focus:ring-danger/20' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
