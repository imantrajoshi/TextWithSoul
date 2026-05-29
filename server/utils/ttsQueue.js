/*
 * Single-worker serial queue for voice-clone synthesis. XTTS is CPU-heavy
 * (~20-40s/clip on a Mac), so we never run two at once. De-dupes by messageId:
 * if a pre-generation job for a message is already queued/running, an on-demand
 * /voice/synthesize request reuses that same promise instead of starting a
 * duplicate clone.
 */
const inflight = new Map(); // messageId -> Promise<cachePath>
let chain = Promise.resolve();

export const enqueueClone = (messageId, jobFn) => {
  if (inflight.has(messageId)) return inflight.get(messageId);

  const run = chain.then(() => jobFn());
  // Keep the worker chain alive regardless of this job's success/failure.
  chain = run.then(
    () => {},
    () => {}
  );

  const tracked = run.finally(() => {
    inflight.delete(messageId);
  });
  inflight.set(messageId, tracked);
  return tracked;
};
