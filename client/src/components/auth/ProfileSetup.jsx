import { useState } from 'react';
import { motion } from 'motion/react';
import Input from '../ui/Input';
import Button from '../ui/Button';

export default function ProfileSetup({ onSubmit, loading }) {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    setError('');
    onSubmit(displayName.trim());
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-display text-text-primary">
          Set up your profile
        </h2>
        <p className="text-sm text-text-secondary">
          Choose a name that others will see
        </p>
      </div>

      {/* Avatar preview */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-accent-muted border-2 border-accent/30 flex items-center justify-center text-2xl font-bold text-accent font-display">
          {displayName
            ? displayName
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : '?'}
        </div>
      </div>

      <Input
        id="display-name-input"
        type="text"
        placeholder="Your name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        error={error}
        maxLength={50}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
        autoFocus
      />

      <Button
        id="complete-profile-btn"
        type="submit"
        loading={loading}
        className="w-full"
        size="lg"
      >
        Let's go
      </Button>
    </motion.form>
  );
}
