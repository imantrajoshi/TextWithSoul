import { getInitials } from '../../utils/helpers';

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export default function UserAvatar({
  user,
  size = 'md',
  showOnline = false,
  className = '',
}) {
  const initials = getInitials(user?.displayName);
  const isOnline = user?.isOnline;

  return (
    <div className={`relative shrink-0 ${className}`}>
      {user?.profilePhoto ? (
        <img
          src={user.profilePhoto}
          alt={user.displayName}
          className={`${sizeMap[size]} rounded-full object-cover bg-bg-tertiary`}
        />
      ) : (
        <div
          className={`
            ${sizeMap[size]} rounded-full
            bg-accent-muted
            flex items-center justify-center
            font-semibold text-accent
            font-display
            border border-accent/10
          `}
        >
          {initials}
        </div>
      )}

      {/* Online indicator */}
      {showOnline && (
        <span
          className={`
            absolute bottom-0 right-0
            w-3 h-3 rounded-full border-2 border-bg-secondary
            transition-colors duration-300
            ${isOnline ? 'bg-online' : 'bg-offline'}
          `}
        />
      )}
    </div>
  );
}
