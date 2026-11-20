import pRetry from 'p-retry';
import { describe, expect, it, vi } from 'vitest';

import { waitDelay } from './retry-after';

// E2E tests call real providers, so a rate limit must wait for the delay the
// provider asks for. The shared test setup makes retries instant only in unit projects.
describe('retry delays in e2e projects', () => {
  it('waits for real in waitDelay', async () => {
    expect(vi.isMockFunction(waitDelay)).toBe(false);
    const started = Date.now();
    await waitDelay(50);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });

  it('keeps p-retry backoff', async () => {
    let attempts = 0;
    const started = Date.now();
    await pRetry(
      async () => {
        if (++attempts < 2) throw new Error('retry me');
      },
      { retries: 1, minTimeout: 50, maxTimeout: 50, randomize: false },
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });
});
