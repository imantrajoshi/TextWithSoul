/*
 * Paid-API usage tracker (EXPERIMENTAL PROTOTYPE — zero-spend policy).
 *
 * Counts calls to the PREMIUM external services (Hume AI, ElevenLabs) so we can
 * watch our footprint and stay inside the free tiers during the prototype phase.
 *
 * Counters are in-memory and reset when the server restarts — that's fine for a
 * demo where you watch the console. They are an approximation of *this process'*
 * activity, NOT the provider's authoritative monthly billing. In production this
 * would be replaced with real usage metering / billing dashboards.
 */

// Approximate free-tier ceilings, for logging context only.
const FREE_TIER = {
  hume: { label: 'Hume AI', note: 'limited free credits/month' },
  elevenlabs: { label: 'ElevenLabs', monthlyFreeChars: 10000 },
};

const usage = {
  hume: { requests: 0 },
  elevenlabs: { requests: 0, characters: 0 },
};

export function trackHume() {
  usage.hume.requests += 1;
  console.log(
    `[USAGE][PAID] Hume AI — request #${usage.hume.requests} this run ` +
    `(free tier: ${FREE_TIER.hume.note})`
  );
}

export function trackElevenLabs(characters = 0) {
  usage.elevenlabs.requests += 1;
  usage.elevenlabs.characters += characters;
  const pct = ((usage.elevenlabs.characters / FREE_TIER.elevenlabs.monthlyFreeChars) * 100).toFixed(1);
  console.log(
    `[USAGE][PAID] ElevenLabs — request #${usage.elevenlabs.requests} this run, ` +
    `+${characters} chars (run total ${usage.elevenlabs.characters}/${FREE_TIER.elevenlabs.monthlyFreeChars} ` +
    `≈ ${pct}% of monthly free tier)`
  );
}

export function getUsage() {
  return { ...usage, freeTier: FREE_TIER };
}
