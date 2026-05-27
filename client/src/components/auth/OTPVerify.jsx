import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import Button from '../ui/Button';

export default function OTPVerify({ phoneNumber, onSubmit, onBack, loading }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    // Allow only digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newOtp.every((d) => d)) {
      onSubmit(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      onSubmit(pastedData);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }
    onSubmit(code);
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
          Verify OTP
        </h2>
        <p className="text-sm text-text-secondary">
          Enter the 6-digit code sent to{' '}
          <span className="text-accent font-medium">{phoneNumber}</span>
        </p>
      </div>

      {/* OTP Input Grid */}
      <div className="flex gap-3 justify-center">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            id={`otp-input-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            className={`
              w-12 h-14 text-center text-xl font-semibold
              bg-bg-tertiary border rounded-xl
              text-text-primary font-sans
              focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
              transition-all duration-150
              ${error ? 'border-danger/50' : digit ? 'border-accent/30' : 'border-border'}
            `}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-danger text-center">{error}</p>
      )}

      <div className="text-center text-xs text-text-tertiary">
        Dev mode: OTP is <span className="text-accent font-mono">123456</span>
      </div>

      <div className="flex gap-3">
        <Button
          id="otp-back-btn"
          variant="secondary"
          onClick={onBack}
          className="flex-1"
          size="lg"
        >
          Back
        </Button>
        <Button
          id="verify-otp-btn"
          type="submit"
          loading={loading}
          className="flex-1"
          size="lg"
        >
          Verify
        </Button>
      </div>
    </motion.form>
  );
}
