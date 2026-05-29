import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../services/api';
import Button from '../ui/Button';

// One short line per emotion. The user records each in that mood, giving the
// (future, free, self-hosted) voice clone a reference sample for every emotion.
const STEPS = [
  { emotion: 'neutral', label: 'Neutral', emoji: '😐', phrase: 'The meeting is scheduled for three o’clock today.' },
  { emotion: 'happy', label: 'Happy', emoji: '😊', phrase: 'Hey! It’s so good to finally hear from you.' },
  { emotion: 'excited', label: 'Excited', emoji: '⚡', phrase: 'I can’t wait — this is going to be amazing!' },
  { emotion: 'sad', label: 'Sad', emoji: '💙', phrase: 'I really miss how things used to be.' },
  { emotion: 'loving', label: 'Loving', emoji: '🌸', phrase: 'You mean the world to me, truly.' },
];

export default function VoiceEnrollment({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [done, setDone] = useState({});
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const current = STEPS[index];
  const allDone = STEPS.every((s) => done[s.emotion]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    setError('');
    try {
      // Capture raw voice — disable browser DSP (noise suppression / auto-gain /
      // echo cancellation) so the enrollment reference keeps the speaker's true
      // timbre and pitch (DSP thinning was making clones sound wrong).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadSample(blob);
      };
      mr.start();
      setIsRecording(true);
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone blocked — please allow access and try again.'
          : 'Could not access microphone.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const uploadSample = async (blob) => {
    setIsBusy(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, `${current.emotion}.webm`);
      fd.append('emotion', current.emotion);
      await api.post('/voice/enroll/sample', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDone((d) => ({ ...d, [current.emotion]: true }));
      if (index < STEPS.length - 1) setIndex(index + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed — try recording again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleFinish = async () => {
    setIsBusy(true);
    setError('');
    try {
      const res = await api.post('/voice/enroll/complete');
      onComplete(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not finish — try again.');
      setIsBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-display text-text-primary">Teach Vybe your voice</h2>
        <p className="text-sm text-text-secondary">
          Read each line out loud in that mood. Later, friends can hear your messages in
          <span className="text-text-primary font-medium"> your own voice, with your emotion</span> — record {STEPS.length} quick clips.
        </p>
      </div>

      {/* Progress pills */}
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s.emotion}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              done[s.emotion] ? 'bg-accent' : i === index ? 'bg-accent/40' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={current.emotion}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="bg-bg-tertiary border border-border rounded-2xl p-6 text-center space-y-4"
        >
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
            {index + 1} of {STEPS.length}
          </div>
          <div className="text-4xl">{current.emoji}</div>
          <div className="text-sm font-semibold text-accent capitalize">{current.label}</div>
          <p className="text-lg font-display text-text-primary leading-snug">“{current.phrase}”</p>

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isBusy}
            className={`mx-auto flex items-center justify-center w-16 h-16 rounded-full transition-all duration-150 ${
              isRecording
                ? 'bg-danger text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse'
                : 'bg-accent text-text-inverse hover:shadow-glow'
            } ${isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isRecording ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
          <div className="text-xs text-text-tertiary h-4">
            {isBusy ? 'Saving…' : isRecording ? 'Tap to stop' : done[current.emotion] ? 'Recorded ✓ — tap to redo' : 'Tap to record'}
          </div>
        </motion.div>
      </AnimatePresence>

      <Button
        type="button"
        onClick={handleFinish}
        loading={isBusy && allDone}
        disabled={!allDone || isBusy}
        className="w-full"
        size="lg"
      >
        {allDone ? 'Finish & enter Vybe' : `Record all ${STEPS.length} to continue`}
      </Button>
    </motion.div>
  );
}
