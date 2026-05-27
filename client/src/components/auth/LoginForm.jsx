import { useState } from 'react';
import { motion } from 'motion/react';
import Input from '../ui/Input';
import Button from '../ui/Button';

export default function LoginForm({ onSubmit, loading }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = phoneNumber.replace(/\s/g, '');
    if (clean.length < 10) {
      setError('Enter a valid phone number (at least 10 digits)');
      return;
    }
    setError('');
    onSubmit(clean);
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
          Welcome
        </h2>
        <p className="text-sm text-text-secondary">
          Enter your phone number to get started
        </p>
      </div>

      <Input
        id="phone-input"
        type="tel"
        placeholder="+91 98765 43210"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        error={error}
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
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        }
        autoFocus
      />

      <Button
        id="send-otp-btn"
        type="submit"
        loading={loading}
        className="w-full"
        size="lg"
      >
        Send OTP
      </Button>
    </motion.form>
  );
}
