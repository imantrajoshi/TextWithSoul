import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import UncertaintyPopup from './UncertaintyPopup';
import EmotionConfirm from './EmotionConfirm';

export default function MessageInput({ conversationId, onSend }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [micError, setMicError] = useState('');
  
  // Phase 3 Emotion State
  const [pendingEmotion, setPendingEmotion] = useState(null);
  const [uncertaintyData, setUncertaintyData] = useState(null);
  // Voice notes: ask the sender to confirm/correct the emotion before sending.
  const [confirmEmotion, setConfirmEmotion] = useState(null);
  
  const { emit } = useSocket();
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const inputRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const typedTimerRef = useRef(null);

  const currentDurationRef = useRef(0);

  useEffect(() => {
    currentDurationRef.current = recordingTime;
  }, [recordingTime]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emit('typing:start', { conversationId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emit('typing:stop', { conversationId });
    }, 2000);
  }, [conversationId, emit]);

  const handleSend = (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emit('typing:stop', { conversationId });
    }

    // Call onSend with the resolved payload (including per-sentence segments).
    // emotionConfirmed=true means the sender explicitly picked the emotion, so
    // the server should trust it verbatim instead of re-reading the words.
    onSend({
      text: trimmed,
      emotion: pendingEmotion?.emotion || 'neutral',
      emotionIntensity: pendingEmotion?.emotionIntensity || 0,
      segments: pendingEmotion?.segments || [],
      emotionConfirmed: pendingEmotion?.confirmed || false
    });

    if (typedTimerRef.current) clearTimeout(typedTimerRef.current);
    setText('');
    setPendingEmotion(null);
    setUncertaintyData(null);
    setConfirmEmotion(null);
    
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.minHeight = '42px';
    }
    inputRef.current?.focus();
  };

  const recognitionRef = useRef(null);

  // Speech-to-text runs entirely in the browser via the FREE Web Speech API
  // (zero spend). Trade-off: needs Chrome/Edge + internet. The recorded audio is
  // still sent to the server, but only for emotion analysis — not transcription.
  // PRODUCTION: swap to a paid/on-device model (e.g. Whisper) for privacy and
  // cross-browser support.
  //
  // A FRESH recognizer is created per recording (see startRecording). Reusing a
  // single SpeechRecognition instance across recordings is unreliable — the 2nd
  // session typically yields no transcript in Chrome/Safari, which made emotion
  // detection come back neutral on every recording after the first.
  const createRecognition = () => {
    if (typeof window === 'undefined') return null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setText(transcript);
    };
    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };
    return rec;
  };

  const stopRecognition = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
    recognitionRef.current = null;
  };

  const startRecording = async () => {
    if (isTranscribing) return;
    
    setMicError('');
    setText(''); // Clear previous text when starting new recording
    setConfirmEmotion(null);
    try {
      // Disable the browser's voice DSP — noise suppression / auto-gain /
      // echo cancellation thin out the low end and lift perceived pitch, which
      // makes the cloned voice sound wrong. We want the raw, natural timbre.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        clearInterval(timerRef.current);

        stopRecognition();

        const duration = currentDurationRef.current;
        setRecordingTime(0);

        if (audioChunksRef.current.length === 0) return;
        if (duration < 1) {
          setMicError('Recording too short.');
          setTimeout(() => setMicError(''), 3000);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Send to backend only for emotion analysis (text already came from Web Speech).
        await handleEmotionAnalysis(audioBlob);
      };

      mediaRecorder.start();
      // Fresh recognizer for THIS recording — reusing one breaks after the first.
      recognitionRef.current = createRecognition();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.error('Speech recognition start failed:', err);
        }
      }
      setIsRecording(true);
      
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Mic error:', err);
      if (err.name === 'NotAllowedError') {
        setMicError('Microphone access denied. Please allow in settings.');
      } else {
        setMicError('Could not access microphone.');
      }
      setTimeout(() => setMicError(''), 4000);
    }
  };

  const stopRecording = (discard = false) => {
    if (!isRecording) return;
    if (discard) {
      audioChunksRef.current = [];
      setText(''); // Clear text if discarded
      setConfirmEmotion(null);
      setPendingEmotion(null);
    }
    stopRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording(false); // Stop and process
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typedTimerRef.current) clearTimeout(typedTimerRef.current);
    };
  }, []);

  // FREE, local emotion detection for TYPED text. Debounced so it runs after the
  // user pauses. Supports multiple emotions per message (per-sentence segments).
  const scheduleTypedAnalysis = (value) => {
    if (typedTimerRef.current) clearTimeout(typedTimerRef.current);
    if (!value.trim()) {
      setPendingEmotion(null);
      return;
    }
    typedTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/voice/analyze-text', { text: value });
        if (res.data.emotion === 'neutral' && !res.data.isMixed) {
          setPendingEmotion(null);
        } else {
          setPendingEmotion({
            emotion: res.data.emotion || 'neutral',
            emotionIntensity: res.data.emotionIntensity || 0,
            segments: res.data.segments || [],
            emotions: res.data.emotions || [],
            isMixed: !!res.data.isMixed,
          });
        }
      } catch {
        /* free local detection — ignore transient errors */
      }
    }, 500);
  };

  const handleEmotionAnalysis = async (blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');
      // Send the free Web Speech transcript — it's the primary emotion signal.
      formData.append('text', text || '');

      const res = await api.post('/voice/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Provisional detection (used if the sender dismisses the confirm popup).
      const detected = res.data.emotion || 'neutral';
      setPendingEmotion({
        emotion: detected,
        emotionIntensity: res.data.emotionIntensity || 0,
        segments: res.data.segments || [],
        emotions: res.data.emotions || [],
        isMixed: !!res.data.isMixed,
        confirmed: false,
      });
      // Ask the sender to confirm/correct how they said it — the words can miss
      // the tone (e.g. an angry voice with neutral words). Carry the mixed
      // breakdown so the popup can offer "Keep mixed".
      setConfirmEmotion({
        detected,
        isMixed: !!res.data.isMixed,
        emotions: res.data.emotions || [],
        segments: res.data.segments || [],
      });

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 128) + 'px';
        }
      }, 0);
    } catch (err) {
      console.error(err);
      setMicError("Couldn't analyze audio. Try again.");
      setTimeout(() => setMicError(''), 4000);
    } finally {
      setIsTranscribing(false);
      inputRef.current?.focus();
    }
  };

  const handleUncertaintySelect = (selectedEmotion) => {
    setPendingEmotion({
      emotion: selectedEmotion,
      emotionIntensity: uncertaintyData.intensity
    });
    setUncertaintyData(null);
  };

  const handleUncertaintyDismiss = () => {
    setPendingEmotion({
      emotion: uncertaintyData.defaultEmotion,
      emotionIntensity: uncertaintyData.intensity
    });
    setUncertaintyData(null);
  };

  // Sender confirmed for a voice note → trust it (sent as "confirmed").
  // 'mixed' keeps the detected per-sentence breakdown; otherwise collapse to one.
  const handleEmotionConfirm = (value) => {
    if (value === 'mixed') {
      setPendingEmotion((prev) => ({
        emotion: prev?.emotion || confirmEmotion?.detected || 'neutral',
        emotionIntensity: prev?.emotionIntensity || 0.8,
        segments: confirmEmotion?.segments || [],
        emotions: confirmEmotion?.emotions || [],
        isMixed: true,
        confirmed: true,
      }));
    } else {
      setPendingEmotion({
        emotion: value,
        emotionIntensity: 0.8,
        segments: [{ text, emotion: value, emotionIntensity: 0.8 }],
        emotions: value !== 'neutral' ? [value] : [],
        isMixed: false,
        confirmed: true,
      });
    }
    setConfirmEmotion(null);
    inputRef.current?.focus();
  };

  // Sender dismissed → keep the auto-detected emotion (not confirmed).
  const handleEmotionConfirmDismiss = () => {
    setConfirmEmotion(null);
    inputRef.current?.focus();
  };

  const getEmojiForEmotion = (emo) => {
    const map = { excited: '⚡', happy: '😊', sad: '💙', angry: '🔴', anxious: '😰', loving: '🌸', neutral: '' };
    return map[emo] || '';
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {uncertaintyData && (
          <UncertaintyPopup
            options={uncertaintyData.options}
            onSelect={handleUncertaintySelect}
            onDismiss={handleUncertaintyDismiss}
          />
        )}
        {confirmEmotion && !isRecording && !isTranscribing && (
          <EmotionConfirm
            detected={confirmEmotion.detected}
            isMixed={confirmEmotion.isMixed}
            emotions={confirmEmotion.emotions}
            onSelect={handleEmotionConfirm}
            onDismiss={handleEmotionConfirmDismiss}
          />
        )}
      </AnimatePresence>

      {/* Tiny pending indicator */}
      {pendingEmotion && !confirmEmotion && (pendingEmotion.emotion !== 'neutral' || pendingEmotion.isMixed) && !isRecording && !isTranscribing && (
        <div className="absolute -top-7 right-4 bg-bg-elevated border border-border-subtle rounded-full px-2.5 py-1 text-xs shadow-sm flex items-center gap-1.5 text-text-secondary animate-fade-in z-10">
          {pendingEmotion.isMixed && pendingEmotion.emotions?.length > 1 ? (
            <>
              <span>{pendingEmotion.emotions.map(getEmojiForEmotion).join(' ')}</span>
              <span className="capitalize">mixed</span>
            </>
          ) : (
            <>
              <span>{getEmojiForEmotion(pendingEmotion.emotion)}</span>
              <span className="capitalize">{pendingEmotion.emotion}</span>
            </>
          )}
          <button
            type="button"
            onClick={() => setPendingEmotion(null)}
            className="ml-1 text-text-tertiary hover:text-danger rounded-full p-0.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="px-4 py-3 border-t border-border-subtle relative">
        <AnimatePresence>
          {micError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 bg-danger text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap shadow-md z-10"
            >
              {micError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 relative">
          {/* Mic button (Toggle) */}
          <div className="relative group">
            <motion.button
              type="button"
              onClick={toggleRecording}
              whileHover={!isTranscribing ? { scale: 1.05 } : {}}
              whileTap={!isTranscribing ? { scale: 0.95 } : {}}
              className={`
                p-2.5 rounded-xl shrink-0 transition-colors duration-150 cursor-pointer select-none flex items-center justify-center
                ${isRecording ? 'bg-danger text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'text-text-secondary hover:bg-bg-tertiary'}
                ${isTranscribing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={isTranscribing}
            >
              {isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
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
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </motion.button>
          </div>

          {/* Text input container / Recording UI */}
          <div className="flex-1 relative overflow-hidden rounded-2xl bg-bg-tertiary border border-border min-h-[42px] flex items-center">
            
            <AnimatePresence mode="wait">
              {isRecording ? (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute inset-0 z-10 bg-bg-tertiary flex items-center justify-between px-4 w-full"
                >
                  <div className="flex items-center gap-2 text-danger flex-1 overflow-hidden">
                    <div className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse shrink-0" />
                    <span className="text-sm font-bold font-mono tracking-wider shrink-0">{formatTime(recordingTime)}</span>
                    <span className="text-sm font-medium text-text-secondary ml-2 truncate">
                      {text ? text : 'Listening...'}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => stopRecording(true)} // true = discard
                    className="text-text-tertiary hover:text-danger text-sm font-medium transition-colors p-1"
                  >
                    Cancel
                  </button>
                </motion.div>
              ) : (
                <motion.textarea
                  key="textarea"
                  ref={inputRef}
                  id="message-input"
                  value={isTranscribing ? (text || 'Analyzing emotion...') : text}
                  onChange={(e) => {
                    if (isTranscribing) return;
                    setText(e.target.value);
                    handleTyping();
                    scheduleTypedAnalysis(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isTranscribing) handleSend();
                    }
                  }}
                  disabled={isTranscribing}
                  placeholder="Type a message..."
                  rows={1}
                  className={`
                    w-full px-4 py-2.5 pr-12
                    bg-transparent text-text-primary text-sm
                    placeholder:text-text-tertiary
                    focus:outline-none
                    transition-all duration-150
                    resize-none max-h-32
                    font-sans self-end
                    ${isTranscribing ? 'animate-pulse text-text-secondary opacity-70' : ''}
                  `}
                  style={{
                    height: 'auto',
                  }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Send button */}
          <motion.button
            type="submit"
            disabled={(!text.trim() && !isRecording) || isTranscribing}
            whileHover={text.trim() && !isTranscribing ? { scale: 1.05 } : {}}
            whileTap={text.trim() && !isTranscribing ? { scale: 0.95 } : {}}
            className={`
              p-2.5 rounded-xl shrink-0 transition-all duration-150 cursor-pointer
              ${
                text.trim() && !isTranscribing && !isRecording
                  ? 'bg-accent text-text-inverse shadow-sm hover:shadow-glow'
                  : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed opacity-50'
              }
            `}
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
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </motion.button>
        </div>
      </form>
    </div>
  );
}
