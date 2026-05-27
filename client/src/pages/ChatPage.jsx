import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import Sidebar from '../components/sidebar/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import Loader from '../components/ui/Loader';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Vybe';

export default function ChatPage() {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await api.get('/conversations');
        setConversations(res.data.conversations);
      } catch (err) {
        console.error('Load conversations error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  // Set active conversation when URL changes
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find((c) => c._id === conversationId);
      if (conv) {
        setActiveConversation(conv);
      } else {
        // Load this specific conversation
        const loadConversation = async () => {
          try {
            const res = await api.get(`/conversations/${conversationId}`);
            setActiveConversation(res.data.conversation);
          } catch {
            navigate('/chat');
          }
        };
        loadConversation();
      }
    } else {
      setActiveConversation(null);
    }
  }, [conversationId, conversations, navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <Loader size="lg" />
          <p className="text-sm text-text-tertiary mt-4">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-bg-primary overflow-hidden">
      {/* Connection status bar */}
      {!isConnected && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="fixed top-0 left-0 right-0 z-50 bg-warning/10 border-b border-warning/20 text-warning text-xs text-center py-1.5 font-medium"
        >
          Connecting...
        </motion.div>
      )}

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        setConversations={setConversations}
        className={`
          w-full md:w-80 lg:w-96 shrink-0
          ${activeConversation ? 'hidden md:flex' : 'flex'}
        `}
      />

      {/* Chat window or empty state */}
      <div
        className={`
          flex-1 min-w-0
          ${!activeConversation ? 'hidden md:flex flex-col' : 'flex flex-col'}
        `}
      >
        {activeConversation ? (
          <ChatWindow
            key={activeConversation._id}
            conversation={activeConversation}
            onBack={() => navigate('/chat')}
          />
        ) : (
          /* Empty state — no conversation selected */
          <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary text-center px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="w-20 h-20 rounded-3xl bg-accent-subtle border border-accent/10 flex items-center justify-center mb-6"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent/50"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </motion.div>
            <h2 className="text-xl font-bold font-display text-text-primary mb-2">
              {APP_NAME}
            </h2>
            <p className="text-sm text-text-secondary max-w-xs">
              Select a conversation or start a new chat to begin messaging
            </p>
            <p className="text-xs text-text-tertiary mt-4">
              End-to-end emotion. Coming soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
