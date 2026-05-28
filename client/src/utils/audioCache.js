class AudioCache {
  constructor() {
    this.cache = new Map();
  }

  has(messageId) {
    return this.cache.has(messageId);
  }

  get(messageId) {
    return this.cache.get(messageId);
  }

  set(messageId, audioUrl) {
    this.cache.set(messageId, audioUrl);
  }

  delete(messageId) {
    const url = this.cache.get(messageId);
    if (url) {
      URL.revokeObjectURL(url);
      this.cache.delete(messageId);
    }
  }

  clear() {
    this.cache.forEach((url) => URL.revokeObjectURL(url));
    this.cache.clear();
  }
}

export const audioCache = new AudioCache();
