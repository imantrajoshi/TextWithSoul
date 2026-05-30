/*
 * ──────────────────────────────────────────────────────────────────────────
 * FREE, LOCAL, MULTI-EMOTION TEXT ANALYZER — ZERO SPEND
 * ──────────────────────────────────────────────────────────────────────────
 * Detects emotion from the message TEXT (which we already have for free from
 * the browser Web Speech API). Deterministic, offline, no external API calls.
 *
 * Splits a message into sentences AND clauses (on contrastive conjunctions like
 * "but"/"however") so a single message can carry MULTIPLE emotions — e.g.
 * "I'm so happy to see you, but I'm really nervous about tomorrow" → happy + anxious.
 *
 * PRODUCTION: can be augmented with a paid model (Hume prosody) or an on-device
 * ML classifier; for now this is the reliable, free primary signal.
 * ──────────────────────────────────────────────────────────────────────────
 */

export const EMOTIONS = ['excited', 'happy', 'sad', 'angry', 'anxious', 'loving', 'neutral'];

// Multi-word phrases carry the most meaning, so they are matched first and
// weighted higher. Many encode negation directly ("not in a good mood").
const PHRASES = [
  // sad
  ['broke up', 'sad', 3.5], ['break up', 'sad', 3], ['breaking up', 'sad', 3],
  ['not in a good mood', 'sad', 3.5], ['not feeling good', 'sad', 3], ['not feeling well', 'sad', 2.5],
  ['not okay', 'sad', 2.5], ['not ok', 'sad', 2.5], ['not great', 'sad', 2], ['not good', 'sad', 2],
  ['miss you', 'sad', 2.5], ['i miss', 'sad', 2], ['feel down', 'sad', 3], ['feeling down', 'sad', 3],
  ['so alone', 'sad', 3], ['want to cry', 'sad', 3.5], ['let me down', 'sad', 2.5],
  ['gave up', 'sad', 2], ['falling apart', 'sad', 3], ['no one cares', 'sad', 3],
  // loving
  ['i love you', 'loving', 4], ['love you', 'loving', 3.5], ['mean the world', 'loving', 3.5],
  ['care about you', 'loving', 3], ['thinking of you', 'loving', 2.5], ['my love', 'loving', 2.5],
  // excited
  ["can't wait", 'excited', 3.5], ['cannot wait', 'excited', 3.5], ['so excited', 'excited', 3.5],
  ['look forward', 'excited', 2.5], ["let's go", 'excited', 2.5], ['lets go', 'excited', 2.5],
  ['this is amazing', 'excited', 3], ['best day', 'excited', 3],
  // anxious
  ['so nervous', 'anxious', 3.5], ['really worried', 'anxious', 3.5], ['freaking out', 'anxious', 3.5],
  ['what if', 'anxious', 1.5], ['i am scared', 'anxious', 3], ["i'm scared", 'anxious', 3],
  ['stressed out', 'anxious', 3], ['on edge', 'anxious', 2.5],
  // angry
  ['fed up', 'angry', 3.5], ['so angry', 'angry', 3.5], ['pissed off', 'angry', 3.5],
  ['hate this', 'angry', 3], ['shut up', 'angry', 2.5], ['sick of', 'angry', 2.5], ['how dare', 'angry', 3],
  // happy
  ['so happy', 'happy', 3.5], ['so glad', 'happy', 3.5], ['good news', 'happy', 3],
  ['thank you so much', 'happy', 2.5], ['well done', 'happy', 2.5], ['great job', 'happy', 3],
  ['made my day', 'happy', 3],
];

// Single source of truth for keyword weights, grouped by emotion.
const LEXICON = {
  happy: {
    happy: 2.5, glad: 2.5, joy: 2.5, joyful: 2.5, great: 1.5, awesome: 2, wonderful: 2.5,
    good: 1, nice: 1, lovely: 2, smile: 1.5, smiling: 1.5, pleased: 2, delighted: 2.5,
    cheerful: 2.5, congrats: 2.5, congratulations: 2.5, lol: 1.5, haha: 1.5,
    hehe: 1.5, lmao: 2, blessed: 2, birthday: 1.5,
  },
  excited: {
    excited: 3, exciting: 3, thrilled: 3, ecstatic: 3.5, pumped: 3, hyped: 3, amazing: 2.5,
    incredible: 2.5, wow: 2, omg: 1.5, celebrate: 2.5, woohoo: 3, stoked: 3, fantastic: 2.5,
    yay: 2.5, yippee: 3, yes: 1.5,
  },
  sad: {
    sad: 3, unhappy: 3, depressed: 3.5, miserable: 3.5, heartbroken: 4, cry: 2.5, crying: 3,
    tears: 2.5, lonely: 3, alone: 1.5, hurt: 2, hurts: 2, broken: 2, sorrow: 3, grief: 3,
    miss: 1.5, missing: 1.5, upset: 2.5, sucks: 1.5, terrible: 2, awful: 2, worst: 2, devastated: 3.5,
    failed: 2, fail: 1.5, rejected: 2, disappointed: 2.5,
  },
  angry: {
    angry: 3, mad: 2.5, furious: 3.5, rage: 3.5, hate: 3, annoyed: 2.5, irritated: 2.5,
    frustrated: 3, pissed: 3, disgusting: 2.5, idiot: 2.5, damn: 1.5, ridiculous: 2, outrageous: 2.5,
  },
  anxious: {
    anxious: 3, nervous: 3, worried: 3, worry: 2.5, scared: 3, afraid: 3, fear: 2.5, terrified: 3.5,
    panic: 3.5, panicking: 3.5, stressed: 3, stress: 2.5, overwhelmed: 3, uneasy: 2.5, tense: 2.5,
    dread: 3, restless: 2.5, terrifying: 3, scary: 2, frightening: 3,
  },
  loving: {
    love: 3, adore: 3, sweetheart: 3, darling: 3, beloved: 3, cherish: 3, hug: 1.5, hugs: 2,
    kiss: 1.5, kisses: 2, caring: 2.5, affection: 2.5,
  },
};

// Derive word → weight and word → emotion lookups from the single LEXICON.
const WORD_WEIGHT = {};
const WORD_EMOTION = {};
for (const [emotion, words] of Object.entries(LEXICON)) {
  for (const [word, weight] of Object.entries(words)) {
    WORD_WEIGHT[word] = weight;
    WORD_EMOTION[word] = emotion;
  }
}

const EMOJI = {
  '😊': 'happy', '😄': 'happy', '😃': 'happy', '🙂': 'happy', '😁': 'happy', '😀': 'happy', '☺️': 'happy',
  '🥳': 'excited', '🎉': 'excited', '🤩': 'excited', '⚡': 'excited', '🔥': 'excited', '🚀': 'excited',
  '😢': 'sad', '😭': 'sad', '😔': 'sad', '😞': 'sad', '💔': 'sad', '🥺': 'sad', '😓': 'sad',
  '😡': 'angry', '😠': 'angry', '🤬': 'angry', '👿': 'angry',
  '😰': 'anxious', '😨': 'anxious', '😱': 'anxious', '😟': 'anxious', '😬': 'anxious',
  '❤️': 'loving', '😍': 'loving', '🥰': 'loving', '😘': 'loving', '💕': 'loving',
  '💗': 'loving', '💖': 'loving', '🌸': 'loving',
};

const NEGATORS = new Set([
  'not', 'no', 'never', 'dont', "don't", 'didnt', "didn't", 'isnt', "isn't",
  'aint', "ain't", 'wasnt', "wasn't", 'cannot', 'cant', "can't", 'wont', "won't",
]);
const INTENSIFIERS = new Set([
  'so', 'very', 'really', 'super', 'extremely', 'totally', 'absolutely',
  'incredibly', 'too', 'freaking',
]);
const POSITIVE = new Set(['happy', 'excited', 'loving']);
const GREETINGS = new Set(['hi', 'hey', 'hello', 'yo', 'yay', 'woo', 'woohoo', 'yes', 'haha', 'lol']);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Split a message into emotional units: sentences first, then clauses on
// contrastive conjunctions ("but", "however", ...) to catch within-sentence shifts.
const segmentize = (text) => {
  const normalized = text.replace(/\r?\n+/g, '. ');
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const out = [];
  for (const sentence of sentences) {
    const parts = sentence.split(/\s*\b(?:but|however|although|though|yet|whereas)\b\s*/i);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out.length ? out : (text.trim() ? [text.trim()] : []);
};

// Score one segment → { emotion, emotionIntensity }.
const scoreSegment = (segment) => {
  const lower = segment.toLowerCase();
  const scores = {};
  const add = (emotion, weight) => { scores[emotion] = (scores[emotion] || 0) + weight; };

  // 1. Phrases
  for (const [phrase, emotion, weight] of PHRASES) {
    if (lower.includes(phrase)) add(emotion, weight);
  }

  // 2. Emoji
  for (const [glyph, emotion] of Object.entries(EMOJI)) {
    if (segment.includes(glyph)) add(emotion, 2.5);
  }

  // 3. Words (with negation + intensifier handling + elongation)
  const tokens = lower.match(/[a-z']+/g) || [];
  let elongationBoost = 0;
  tokens.forEach((tok, i) => {
    if (/([a-z])\1\1+/.test(tok)) {
      elongationBoost += 0.12;
      const base = tok.replace(/([a-z])\1+/g, '$1');
      if (GREETINGS.has(base)) add('excited', 2);
    }
    const collapsed = tok.replace(/([a-z])\1{2,}/g, '$1$1');
    const weightBase = WORD_WEIGHT[tok] ?? WORD_WEIGHT[collapsed];
    const emotion = WORD_EMOTION[tok] ?? WORD_EMOTION[collapsed];
    if (weightBase == null || !emotion) return;

    const prev = tokens[i - 1];
    const prev2 = tokens[i - 2];
    const negated = NEGATORS.has(prev) || NEGATORS.has(prev2);
    let weight = weightBase;
    if (INTENSIFIERS.has(prev)) weight *= 1.5;

    if (negated) {
      if (POSITIVE.has(emotion)) add('sad', weight * 0.8); // "not happy" → sad
      return; // negated negative ("not sad") ≈ neutral → ignore
    }
    add(emotion, weight);
  });

  // 4. Modifiers
  const exclaims = (segment.match(/!/g) || []).length;
  const capsWords = (segment.match(/\b[A-Z]{2,}\b/g) || []).length;
  const boost = clamp(exclaims, 0, 3) * 0.06 + clamp(capsWords, 0, 4) * 0.05 + elongationBoost;

  // Strong exclamation on a positive message nudges happy → excited.
  if (exclaims >= 2 && (scores.happy || 0) > 0) add('excited', scores.happy * 0.5);

  let topEmotion = 'neutral';
  let topScore = 0;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > topScore) { topScore = score; topEmotion = emotion; }
  }

  if (topScore <= 0) return { emotion: 'neutral', emotionIntensity: 0 };

  const intensity = clamp(0.45 + topScore * 0.1 + boost, 0.45, 0.97);
  return { emotion: topEmotion, emotionIntensity: Number(intensity.toFixed(2)) };
};

const neutralResult = (text) => ({
  emotion: 'neutral',
  emotionIntensity: 0,
  segments: text && text.trim() ? [{ text: text.trim(), emotion: 'neutral', emotionIntensity: 0 }] : [],
  emotions: [],
  isMixed: false,
  isUncertain: false,
  uncertaintyOptions: null,
});

// Public API: analyze a full message → dominant emotion + per-segment breakdown.
export const analyzeText = (text) => {
  if (!text || !text.trim()) return neutralResult('');

  const parts = segmentize(text);
  const segments = parts.map((part) => {
    const { emotion, emotionIntensity } = scoreSegment(part);
    return { text: part, emotion, emotionIntensity };
  });

  const distinct = [...new Set(segments.map((s) => s.emotion).filter((e) => e !== 'neutral'))];

  let dominant = { emotion: 'neutral', emotionIntensity: 0 };
  for (const s of segments) {
    if (s.emotion !== 'neutral' && s.emotionIntensity > dominant.emotionIntensity) {
      dominant = { emotion: s.emotion, emotionIntensity: s.emotionIntensity };
    }
  }

  return {
    emotion: dominant.emotion,
    emotionIntensity: dominant.emotionIntensity,
    segments,
    emotions: distinct,
    isMixed: distinct.length >= 2,
    isUncertain: false,
    uncertaintyOptions: null,
  };
};

export default analyzeText;
