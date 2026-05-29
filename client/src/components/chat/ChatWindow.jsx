import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import Loader from '../ui/Loader';
import { getOtherParticipant, formatDate } from '../../utils/helpers';

export default function ChatWindow({ conversation, onBack }) {
  const { user } = useAuth();
  const { emit, on } = useSocket();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [readyAudioIds, setReadyAudioIds] = useState(() => new Set());

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const hasJoinedRef = useRef(false);

  const otherUser = getOtherParticipant(conversation.participants, user._id);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 50);
  }, []);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/messages/${conversation._id}?limit=50`);
        setMessages(res.data.messages);
        scrollToBottom('instant');
      } catch (err) {
        console.error('Load messages error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [conversation._id, scrollToBottom]);

  // Join/leave conversation room
  useEffect(() => {
    if (!hasJoinedRef.current) {
      emit('conversation:join', { conversationId: conversation._id });
      emit('message:read', { conversationId: conversation._id });
      hasJoinedRef.current = true;
    }

    return () => {
      emit('conversation:leave', { conversationId: conversation._id });
      hasJoinedRef.current = false;
    };
  }, [conversation._id, emit]);

  // Listen for new messages
  useEffect(() => {
    const cleanup = on('message:received', ({ message }) => {
      if (message.conversationId === conversation._id) {
        setMessages((prev) => {
          // Prevent duplicate messages
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();

        // Mark as read
        if (message.senderId?._id !== user._id) {
          emit('message:read', { conversationId: conversation._id });
        }
      }
    });

    return cleanup;
  }, [conversation._id, on, scrollToBottom, user._id, emit]);

  // Pre-generated voice clone is ready → flip the bubble's indicator to "ready".
  useEffect(() => {
    const cleanup = on('audio:ready', ({ messageId, conversationId }) => {
      if (conversationId === conversation._id) {
        setReadyAudioIds((prev) => {
          const next = new Set(prev);
          next.add(messageId);
          return next;
        });
      }
    });

    return cleanup;
  }, [conversation._id, on]);

  // Listen for typing updates
  useEffect(() => {
    const cleanup = on('typing:update', ({ userId, conversationId, isTyping }) => {
      if (conversationId === conversation._id && userId !== user._id) {
        setTypingUsers((prev) => {
          if (isTyping) {
            return { ...prev, [userId]: true };
          } else {
            const updated = { ...prev };
            delete updated[userId];
            return updated;
          }
        });
      }
    });

    return cleanup;
  }, [conversation._id, on, user._id]);

  // Send message
  const handleSend = (messageData) => {
    // messageData can be a string (fallback) or an object with { text, emotion, emotionIntensity }
    const payload = typeof messageData === 'string' 
      ? { conversationId: conversation._id, text: messageData }
      : { conversationId: conversation._id, ...messageData };

    emit('message:send', payload);
  };

  // Group messages by date
  const getMessageGroups = () => {
    const groups = [];
    let currentDate = null;

    messages.forEach((msg) => {
      const msgDate = formatDate(msg.createdAt);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date', label: msgDate, id: `date-${msg.createdAt}` });
      }
      groups.push({ type: 'message', data: msg, id: msg._id });
    });

    return groups;
  };

  const isTyping = Object.keys(typingUsers).length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-bg-primary">
      {/* Header */}
      <ChatHeader otherUser={otherUser} onBack={onBack} />

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto py-4"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader size="md" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-accent-subtle border border-accent/10 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent/60"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <p className="text-sm text-text-secondary font-medium">
              Start a conversation
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              Send a message to {otherUser?.displayName || 'this user'}
            </p>
          </div>
        ) : (
          <>
            {getMessageGroups().map((item) => {
              if (item.type === 'date') {
                return (
                  <div
                    key={item.id}
                    className="flex justify-center my-4"
                  >
                    <span className="bg-bg-elevated text-text-tertiary text-xs px-3 py-1 rounded-full border border-border-subtle">
                      {item.label}
                    </span>
                  </div>
                );
              }

              const msg = item.data;
              const senderId = msg.senderId?._id || msg.senderId;
              const isMine = senderId === user._id;

              return (
                <MessageBubble
                  key={msg._id}
                  message={msg}
                  isMine={isMine}
                  emotion={msg.emotion}
                  emotionIntensity={msg.emotionIntensity}
                  audioReady={readyAudioIds.has(msg._id)}
                />
              );
            })}

            {/* Typing indicator */}
            <AnimatePresence>
              {isTyping && (
                <TypingIndicator
                  userName={otherUser?.displayName || 'Someone'}
                />
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <MessageInput conversationId={conversation._id} onSend={handleSend} />
    </div>
  );
}
