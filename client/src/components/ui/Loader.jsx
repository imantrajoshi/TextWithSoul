export default function Loader({ size = 'md', className = '' }) {
  const sizeMap = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`
          ${sizeMap[size]}
          rounded-full
          border-bg-tertiary
          border-t-accent
          animate-spin
        `}
      />
    </div>
  );
}
