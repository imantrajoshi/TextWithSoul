// Ensures only ONE message plays at a time across all message bubbles.
// Each bubble registers a stop callback when it starts playing; registering a
// new one first stops whatever was playing before (audio clip or browser TTS).
let activeStop = null;

export const playbackManager = {
  // Call when a bubble starts playing. Stops the previously playing bubble.
  start(stopFn) {
    if (activeStop && activeStop !== stopFn) {
      const previous = activeStop;
      activeStop = stopFn;
      previous(); // reset the other bubble's audio + UI
    } else {
      activeStop = stopFn;
    }
  },
  // Call when a bubble stops on its own (finished / user stopped / unmounted).
  release(stopFn) {
    if (activeStop === stopFn) activeStop = null;
  },
};

export default playbackManager;
