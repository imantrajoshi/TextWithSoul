import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import ConversationItem from './ConversationItem';
import SearchUsers from './SearchUsers';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Vybe';

export default function Sidebar({ conversations, setConversations, className = '' }) {
  const { user, logout } = useAuth();
  const { on } = useSocket();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [showSearch, setShowSearch] = useState(false);

  // Listen for conversation updates
  useEffect(() => {
    const cleanup = on('conversation:updated', ({ conversationId: convId, lastMessage }) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c._id === convId ? { ...c, lastMessage } : c
        );
        // Sort by last message time
        return updated.sort(
          (a, b) =>
            new Date(b.lastMessage?.createdAt || b.createdAt) -
            new Date(a.lastMessage?.createdAt || a.createdAt)
        );
      });
    });

    return cleanup;
  }, [on, setConversations]);

  const handleSelectUser = async (selectedUser) => {
    try {
      const res = await api.post('/conversations', {
        participantId: selectedUser._id,
      });
      const { conversation, isNew } = res.data;

      if (isNew) {
        setConversations((prev) => [conversation, ...prev]);
      }

      setShowSearch(false);
      navigate(`/chat/${conversation._id}`);
    } catch (err) {
      console.error('Create conversation error:', err);
    }
  };

  const handleConversationClick = (convId) => {
    navigate(`/chat/${convId}`);
  };

  return (
    <div
      className={`
        flex flex-col h-full bg-bg-secondary
        border-r border-border-subtle
        ${className}
      `}
    >
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-border-subtle">
        <h1 className="text-xl font-bold font-display text-text-primary tracking-tight">
          {APP_NAME}
        </h1>
        <div className="flex items-center gap-1">
          {/* New chat button */}
          <button
            id="new-chat-btn"
            onClick={() => setShowSearch(true)}
            className="p-2 rounded-xl text-text-secondary hover:text-accent hover:bg-accent-subtle transition-all cursor-pointer"
            title="New chat"
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
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>

          {/* Logout button */}
          <button
            id="logout-btn"
            onClick={logout}
            className="p-2 rounded-xl text-text-secondary hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
            title="Logout"
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Panel or Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {showSearch ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <SearchUsers
                onSelectUser={handleSelectUser}
                onClose={() => setShowSearch(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-2 space-y-0.5"
            >
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-text-tertiary"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-text-secondary font-medium">
                    No conversations yet
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Start a new chat to begin
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <ConversationItem
                    key={conv._id}
                    conversation={conv}
                    currentUserId={user._id}
                    isActive={conv._id === conversationId}
                    onClick={() => handleConversationClick(conv._id)}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User info footer */}
      <div className="px-4 py-3 border-t border-border-subtle flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center text-xs font-semibold text-accent">
          {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary truncate">
            {user?.displayName}
          </p>
          <p className="text-xs text-text-tertiary">{user?.phoneNumber}</p>
        </div>
      </div>
    </div>
  );
}
