import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../services/api';
import UserAvatar from './UserAvatar';
import Input from '../ui/Input';
import Loader from '../ui/Loader';

export default function SearchUsers({ onSelectUser, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data.users);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
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
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-text-primary font-display">
          New Chat
        </h3>
      </div>

      <Input
        ref={inputRef}
        id="search-users-input"
        type="text"
        placeholder="Search by name or phone..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        }
      />

      <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
        {loading && <Loader size="sm" className="py-4" />}

        <AnimatePresence>
          {!loading &&
            results.map((user) => (
              <motion.button
                key={user._id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => onSelectUser(user)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-tertiary/50 transition-colors text-left cursor-pointer"
              >
                <UserAvatar user={user} size="sm" showOnline />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {user.displayName || 'No name'}
                  </p>
                  <p className="text-xs text-text-tertiary">{user.phoneNumber}</p>
                </div>
              </motion.button>
            ))}
        </AnimatePresence>

        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-center text-sm text-text-tertiary py-6">
            No users found
          </p>
        )}

        {!loading && query.trim().length < 2 && (
          <p className="text-center text-sm text-text-tertiary py-6">
            Type at least 2 characters to search
          </p>
        )}
      </div>
    </div>
  );
}
