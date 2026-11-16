import { describe, expect, it } from 'vitest';

import { VOICE_REQUESTS_PER_MINUTE, voiceRateLimiter } from './rate-limit.js';
import type { VoiceRateLimiter } from './rate-limit.js';

function allow(limiter: VoiceRateLimiter, key: string, times: number) {
  for (let i = 0; i < times; i++) expect(limiter.take(key)).toEqual({ allowed: true });
}

describe('voiceRateLimiter', () => {
  it('lets a caller back in as their oldest requests leave the minute, and says how long to wait', () => {
    let now = 0;
    const limiter = voiceRateLimiter(() => now);
    const half = VOICE_REQUESTS_PER_MINUTE / 2;
    allow(limiter, 'org:user-a', half);
    now = 30_000;
    allow(limiter, 'org:user-a', half);

    now = 45_000;
    expect(limiter.take('org:user-a')).toEqual({ allowed: false, retryAfterSeconds: 15 });

    now = 60_000;
    allow(limiter, 'org:user-a', half);
    expect(limiter.take('org:user-a')).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it('does not slow down one member because another hit the limit', () => {
    const limiter = voiceRateLimiter(() => 0);
    allow(limiter, 'org:user-a', VOICE_REQUESTS_PER_MINUTE);

    expect(limiter.take('org:user-a').allowed).toBe(false);
    expect(limiter.take('org:user-b')).toEqual({ allowed: true });
  });

  it('checking whether a caller may go ahead does not use up one of their requests', () => {
    const limiter = voiceRateLimiter(() => 0);
    allow(limiter, 'org:user-a', VOICE_REQUESTS_PER_MINUTE - 1);

    expect(limiter.check('org:user-a')).toEqual({ allowed: true });
    expect(limiter.check('org:user-a')).toEqual({ allowed: true });
    expect(limiter.take('org:user-a')).toEqual({ allowed: true });
    expect(limiter.check('org:user-a')).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });
});
