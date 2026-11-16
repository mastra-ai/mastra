export const VOICE_REQUESTS_PER_MINUTE = 20;

const WINDOW_MS = 60_000;

export type RateLimitVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface VoiceRateLimiter {
  check(key: string): RateLimitVerdict;
  take(key: string): RateLimitVerdict;
}

export function voiceRateLimiter(now: () => number = Date.now): VoiceRateLimiter {
  const hits = new Map<string, number[]>();

  const recentHits = (key: string, at: number): number[] => {
    const recent = (hits.get(key) ?? []).filter(time => at - time < WINDOW_MS);
    if (recent.length) hits.set(key, recent);
    else hits.delete(key);
    return recent;
  };

  const verdict = (recent: number[], at: number): RateLimitVerdict => {
    if (recent.length < VOICE_REQUESTS_PER_MINUTE) return { allowed: true };
    const oldest = recent[0] ?? at;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + WINDOW_MS - at) / 1000)) };
  };

  return {
    check(key) {
      const at = now();
      return verdict(recentHits(key, at), at);
    },
    take(key) {
      const at = now();
      const recent = recentHits(key, at);
      const result = verdict(recent, at);
      if (result.allowed) hits.set(key, [...recent, at]);
      return result;
    },
  };
}
