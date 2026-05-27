import UserAvatar from '../sidebar/UserAvatar';
import { formatLastSeen } from '../../utils/helpers';

export default function ChatHeader({ otherUser, onBack }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle glass">
      {/* Back button (mobile) */}
      {onBack && (
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
      )}

      <UserAvatar user={otherUser} size="md" showOnline />

      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-text-primary truncate">
          {otherUser?.displayName || 'Unknown'}
        </h2>
        <p className="text-xs text-text-tertiary">
          {otherUser?.isOnline ? (
            <span className="text-online">Online</span>
          ) : (
            `Last seen ${formatLastSeen(otherUser?.lastSeen)}`
          )}
        </p>
      </div>

      {/* Mic button placeholder (Phase 2) */}
      <div className="relative group">
        <button
          disabled
          className="p-2 rounded-xl text-text-tertiary opacity-40 cursor-not-allowed"
          title="Voice messages coming soon"
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
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
        {/* Tooltip */}
        <span className="absolute -bottom-8 right-0 bg-bg-elevated text-text-secondary text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Coming soon
        </span>
      </div>
    </div>
  );
}
