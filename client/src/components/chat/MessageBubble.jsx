import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { formatTime } from '../../utils/helpers';
import { audioCache } from '../../utils/audioCache';
import { playbackManager } from '../../utils/playbackManager';
import api from '../../services/api';

const emotionStyles = {
  excited: {
    bubble: 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] border-orange-400',
    text: 'text-[16px] font-bold tracking-wide',
    otherBubble: 'bg-orange-50 border border-orange-200 text-orange-900 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
  },
  happy: {
    bubble: 'bg-emerald-500 text-white shadow-sm rounded-3xl',
    text: 'text-[15px] font-medium',
    otherBubble: 'bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-3xl',
  },
  sad: {
    bubble: 'bg-slate-500 text-slate-100 shadow-none opacity-90',
    text: 'text-[14px] font-light tracking-wider leading-loose',
    otherBubble: 'bg-slate-50 border border-slate-200 text-slate-700 opacity-90',
  },
  angry: {
    bubble: 'bg-red-600 text-white shadow-[4px_4px_0px_rgba(153,27,27,0.5)] border-red-800 border-2 rounded-sm',
    text: 'text-[15px] font-bold uppercase',
    otherBubble: 'bg-red-50 border-2 border-red-300 text-red-900 shadow-[4px_4px_0px_rgba(252,165,165,0.5)] rounded-sm',
  },
  anxious: {
    bubble: 'bg-teal-600 text-white border-teal-500 border-dashed border-2',
    text: 'text-[14px] font-medium italic',
    otherBubble: 'bg-teal-50 border-2 border-dashed border-teal-300 text-teal-900',
  },
  loving: {
    bubble: 'bg-pink-500 text-white shadow-[0_4px_20px_rgba(236,72,153,0.3)]',
    text: 'text-[15px] font-serif italic',
    otherBubble: 'bg-pink-50 border border-pink-200 text-pink-900 shadow-[0_4px_20px_rgba(236,72,153,0.1)]',
  },
  neutral: {
    bubble: 'bg-accent text-white shadow-sm',
    text: 'text-[15px] leading-relaxed',
    otherBubble: 'bg-white border border-border-subtle text-text-primary shadow-sm',
  }
};

const emotionAnimations = {
  excited: {
    initial: { opacity: 0, scale: 0.5, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 15 } }
  },
  happy: {
    initial: { opacity: 0, y: 30, scale: 0.8 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.6, duration: 0.6 } }
  },
  sad: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  },
  angry: {
    initial: { opacity: 0, x: -50, rotate: -5 },
    animate: { opacity: 1, x: 0, rotate: 0, transition: { type: "spring", stiffness: 500, damping: 10 } }
  },
  anxious: {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 200, damping: 5, mass: 0.5 } }
  },
  loving: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1, transition: { duration: 1, ease: "anticipate" } }
  },
  neutral: {
    initial: { opacity: 0, y: 10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } }
  }
};

// FREE fallback voice. Maps each emotion to rate/pitch so the browser's built-in
// SpeechSynthesis still conveys some emotional flavour when the PAID ElevenLabs
// clone is unavailable (no key / quota / rate-limit). Zero spend.
const EMOTION_TTS = {
  excited: { rate: 1.15, pitch: 1.3 },
  happy: { rate: 1.1, pitch: 1.2 },
  sad: { rate: 0.85, pitch: 0.8 },
  angry: { rate: 1.1, pitch: 0.7 },
  anxious: { rate: 1.2, pitch: 1.1 },
  loving: { rate: 0.95, pitch: 1.15 },
  neutral: { rate: 1.0, pitch: 1.0 },
};

// Per-emotion text colour for mixed-emotion messages (each sentence is shown in
// its own emotion's accent on a neutral bubble so all emotions stay legible).
const emotionTextColor = {
  excited: 'text-orange-500',
  happy: 'text-emerald-600',
  sad: 'text-slate-500',
  angry: 'text-red-600',
  anxious: 'text-teal-600',
  loving: 'text-pink-500',
  neutral: 'text-text-primary',
};

export default function MessageBubble({
  message,
  isMine,
  showAvatar = false,
  emotion = 'neutral',
  emotionIntensity = 0,
}) {
  const getEmojiForEmotion = (emo) => {
    const map = { excited: '⚡', happy: '😊', sad: '💙', angry: '🔴', anxious: '😰', loving: '🌸', neutral: '' };
    return map[emo] || '';
  };

  const currentEmotion = emotionStyles[emotion] ? emotion : 'neutral';
  const style = emotionStyles[currentEmotion];
  const anim = emotionAnimations[currentEmotion];

  const bubbleClass = isMine ? style.bubble : style.otherBubble;
  const radiusClass = isMine ? 'rounded-br-sm' : 'rounded-bl-sm';

  // Per-sentence emotion breakdown. A message is "mixed" when its sentences
  // carry two or more distinct (non-neutral) emotions.
  const segments = Array.isArray(message.segments) ? message.segments : [];
  const distinctEmotions = [...new Set(segments.map((s) => s.emotion).filter((e) => e && e !== 'neutral'))];
  const isMixed = distinctEmotions.length >= 2;

  // Playback State
  const [playState, setPlayState] = useState('idle');
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef(null);
  const usingTTSRef = useRef(false);

  // Stop THIS bubble's playback (audio clip + browser TTS) and reset its UI.
  // Stable identity so the global playbackManager can call it to stop us when
  // another message starts playing.
  const stopPlayback = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    usingTTSRef.current = false;
    setPlayState('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      playbackManager.release(stopPlayback);
    };
  }, [stopPlayback]);

  // FREE fallback playback using the browser's built-in voice. Speaks each
  // sentence with ITS OWN emotion's rate/pitch, so a mixed message sounds happy
  // on the happy line and sad on the sad line. Returns false if SpeechSynthesis
  // isn't available so the caller can show an error instead.
  const speakWithBrowserTTS = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    window.speechSynthesis.cancel();

    const parts = segments.length
      ? segments
      : [{ text: message.text, emotion }];

    usingTTSRef.current = true;
    let i = 0;
    const speakNext = () => {
      if (!usingTTSRef.current || i >= parts.length) {
        usingTTSRef.current = false;
        setPlayState('idle');
        playbackManager.release(stopPlayback);
        return;
      }
      const part = parts[i++];
      const utter = new SpeechSynthesisUtterance(part.text);
      const cfg = EMOTION_TTS[part.emotion] || EMOTION_TTS.neutral;
      utter.rate = cfg.rate;
      utter.pitch = cfg.pitch;
      utter.onend = speakNext;
      utter.onerror = () => { usingTTSRef.current = false; setPlayState('idle'); playbackManager.release(stopPlayback); };
      window.speechSynthesis.speak(utter);
    };
    speakNext();
    return true;
  };

  const handlePlay = async () => {
    if (playState === 'playing') {
      stopPlayback();
      playbackManager.release(stopPlayback);
      return;
    }

    // Take over the single global playback slot — stops any other message.
    playbackManager.start(stopPlayback);

    // Mixed-emotion messages play sentence-by-sentence with per-emotion voices —
    // a single synthesized clip would flatten the mix, so use the free segmented voice.
    if (isMixed) {
      if (speakWithBrowserTTS()) setPlayState('playing');
      else { setHasError(true); playbackManager.release(stopPlayback); }
      return;
    }

    setPlayState('loading');
    try {
      let audioUrl = audioCache.get(message._id);

      if (!audioUrl) {
        // PAID: request the ElevenLabs voice clone. Throws on 503 when the free
        // tier is exhausted or no key is set → handled in catch below.
        const response = await api.post('/voice/synthesize', {
          text: message.text,
          emotion: emotion,
          voiceCloneId: message.sender?.voiceCloneId || null
        }, {
          responseType: 'blob'
        });
        audioUrl = URL.createObjectURL(response.data);
        audioCache.set(message._id, audioUrl);
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = audioUrl;

      audioRef.current.onended = () => {
        setPlayState('idle');
        playbackManager.release(stopPlayback);
      };
      audioRef.current.onerror = () => {
        if (!speakWithBrowserTTS()) { setHasError(true); playbackManager.release(stopPlayback); }
      };

      usingTTSRef.current = false;
      await audioRef.current.play();
      setPlayState('playing');
    } catch (error) {
      // PAID voice unavailable (no key / quota / rate-limit) → gracefully fall
      // back to the FREE browser voice so the demo keeps working. No upgrade.
      console.warn('Voice clone unavailable, using free browser TTS.', error?.message);
      if (speakWithBrowserTTS()) {
        setPlayState('playing');
      } else {
        setHasError(true);
        playbackManager.release(stopPlayback);
      }
    }
  };

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} w-full mb-2`}>
      <motion.div
        initial={anim.initial}
        animate={anim.animate}
        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}
      >
        {isMixed ? (
          // Mixed-emotion message: each sentence in its own emotion's colour/style.
          <div className={`px-4 py-2.5 break-words rounded-2xl ${radiusClass} bg-bg-elevated border border-border-subtle space-y-1`}>
            {segments.map((seg, idx) => {
              const segStyle = emotionStyles[seg.emotion] || emotionStyles.neutral;
              return (
                <p key={idx} className={`whitespace-pre-wrap ${segStyle.text} ${emotionTextColor[seg.emotion] || 'text-text-primary'}`}>
                  {seg.emotion !== 'neutral' && (
                    <span className="mr-1">{getEmojiForEmotion(seg.emotion)}</span>
                  )}
                  {seg.text}
                </p>
              );
            })}
          </div>
        ) : (
          <div
            className={`
              px-4 py-2.5 break-words rounded-2xl ${radiusClass} ${bubbleClass}
            `}
          >
            <p className={`whitespace-pre-wrap ${style.text}`}>{message.text}</p>
          </div>
        )}

        <div className={`flex items-center gap-2 mt-1.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[11px] font-medium text-text-tertiary tracking-wide uppercase">
            {formatTime(message.createdAt)}
          </span>

          {isMixed ? (
            distinctEmotions.map((e) => (
              <span key={e} className="text-[11px] font-medium text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded-full flex items-center gap-1 opacity-70">
                {getEmojiForEmotion(e)} {e}
              </span>
            ))
          ) : (
            emotion && emotion !== 'neutral' && (
              <span className="text-[11px] font-medium text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded-full flex items-center gap-1 opacity-70">
                {getEmojiForEmotion(emotion)} {emotion}
              </span>
            )
          )}

          {!isMine && !hasError && (
            <button
              onClick={handlePlay}
              disabled={playState === 'loading'}
              className="ml-1 p-1 rounded-full bg-bg-tertiary hover:bg-bg-secondary text-text-secondary transition-colors"
              title="Play AI Voice"
            >
              {playState === 'idle' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
              {playState === 'loading' && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {playState === 'playing' && (
                <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
