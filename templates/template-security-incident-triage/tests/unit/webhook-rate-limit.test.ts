import { describe, expect, it } from 'vitest';

import { FixedWindowWebhookRateLimiter } from '../../src/webhook-rate-limit.js';

describe('webhook rate limiter', () => {
  it('separates route/client, resets fixed windows, and fails closed at capacity', () => {
    let now = 0;
    const limiter = new FixedWindowWebhookRateLimiter({
      maxRequests: 1,
      windowMs: 1_000,
      maxBuckets: 2,
      cleanupBatchSize: 1,
      nowMs: () => now,
    });
    expect(limiter.take({ route: 'alerts', client: 'a' }).allowed).toBe(true);
    expect(limiter.take({ route: 'workos', client: 'a' }).allowed).toBe(true);
    expect(limiter.take({ route: 'alerts', client: 'b' })).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    now = 1_000;
    expect(limiter.take({ route: 'alerts', client: 'b' }).allowed).toBe(true);
  });
});
