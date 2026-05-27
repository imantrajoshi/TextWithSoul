import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import OTPVerify from '../components/auth/OTPVerify';
import ProfileSetup from '../components/auth/ProfileSetup';
import api from '../services/api';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Vybe';

export default function AuthPage() {
  const { login, updateUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'profile'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Send OTP
  const handleSendOTP = async (phone) => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/send-otp', { phoneNumber: phone });
      setPhoneNumber(phone);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (otp) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-otp', { phoneNumber, otp });
      const { token, user, isNewUser } = res.data;
      login(token, user);

      if (isNewUser || !user.displayName) {
        setStep('profile');
      } else {
        navigate('/chat');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Setup profile
  const handleSetupProfile = async (displayName) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.patch('/auth/setup-profile', { displayName });
      updateUser(res.data.user);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo / Brand Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-subtle border border-accent/20 mb-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </motion.div>
          <h1 className="text-2xl font-bold font-display text-text-primary tracking-tight">
            {APP_NAME}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Sign in to your account
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-bg-secondary border border-border/60 rounded-3xl p-6 sm:p-8 shadow-xl">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 mb-6 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {step === 'phone' && (
              <LoginForm
                key="phone"
                onSubmit={handleSendOTP}
                loading={loading}
              />
            )}
            {step === 'otp' && (
              <OTPVerify
                key="otp"
                phoneNumber={phoneNumber}
                onSubmit={handleVerifyOTP}
                onBack={() => {
                  setStep('phone');
                  setError('');
                }}
                loading={loading}
              />
            )}
            {step === 'profile' && (
              <ProfileSetup
                key="profile"
                onSubmit={handleSetupProfile}
                loading={loading}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Minimal Step indicator */}
        <div className="flex justify-center gap-2 mt-6">
          {['phone', 'otp', 'profile'].map((s, i) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ease-out ${
                step === s
                  ? 'w-6 bg-accent'
                  : i < ['phone', 'otp', 'profile'].indexOf(step)
                  ? 'w-4 bg-accent/30'
                  : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
