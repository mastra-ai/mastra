import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeDelay, isTransientLLMError, RETRY_CONFIG, withRetry } from '../retry';

describe('isTransientLLMError', () => {
  it('matches undici "terminated" error messages', () => {
    expect(isTransientLLMError(new TypeError('terminated'))).toBe(true);
    expect(isTransientLLMError(new Error('TypeError: terminated'))).toBe(true);
  });

  it('matches undici UND_ERR_* error codes', () => {
    const err = Object.assign(new Error('something bad'), { code: 'UND_ERR_SOCKET' });
    expect(isTransientLLMError(err)).toBe(true);
  });

  it('matches common transport substrings', () => {
    expect(isTransientLLMError(new Error('fetch failed'))).toBe(true);
    expect(isTransientLLMError(new Error('ECONNRESET'))).toBe(true);
    expect(isTransientLLMError(new Error('socket hang up'))).toBe(true);
    expect(isTransientLLMError(new Error('connection closed'))).toBe(true);
    expect(isTransientLLMError(new Error('Request timeout'))).toBe(true);
  });

  it('matches retryable HTTP statuses', () => {
    expect(isTransientLLMError({ statusCode: 500 })).toBe(true);
    expect(isTransientLLMError({ statusCode: 502 })).toBe(true);
    expect(isTransientLLMError({ statusCode: 429 })).toBe(true);
    expect(isTransientLLMError({ statusCode: 408 })).toBe(true);
  });

  it('matches AI SDK-style isRetryable: true', () => {
    expect(isTransientLLMError({ isRetryable: true })).toBe(true);
  });

  it('walks the error.cause chain', () => {
    const cause = new TypeError('terminated');
    const wrapper = new Error('agent stream failed');
    (wrapper as any).cause = cause;
    expect(isTransientLLMError(wrapper)).toBe(true);
  });

  it('walks the error.error chain (some AI SDK wrappers)', () => {
    const inner = Object.assign(new Error('boom'), { code: 'UND_ERR_CONNECT_TIMEOUT' });
    const wrapper = new Error('wrapped');
    (wrapper as any).error = inner;
    expect(isTransientLLMError(wrapper)).toBe(true);
  });

  it('does NOT retry on AbortError', () => {
    const err = new Error('cancelled');
    (err as any).name = 'AbortError';
    expect(isTransientLLMError(err)).toBe(false);
  });

  it('does NOT retry on DOMException-style abort code', () => {
    expect(isTransientLLMError({ name: 'Error', code: 'ABORT_ERR' })).toBe(false);
  });

  it('does NOT retry on auth / validation / 4xx errors', () => {
    expect(isTransientLLMError({ statusCode: 401 })).toBe(false);
    expect(isTransientLLMError({ statusCode: 403 })).toBe(false);
    expect(isTransientLLMError({ statusCode: 400 })).toBe(false);
    expect(isTransientLLMError({ statusCode: 404 })).toBe(false);
    expect(isTransientLLMError({ statusCode: 422 })).toBe(false);
  });

  it('does NOT retry on plain errors with non-transport messages', () => {
    expect(isTransientLLMError(new Error('invalid api key'))).toBe(false);
    expect(isTransientLLMError(new Error('schema validation failed'))).toBe(false);
  });

  it('handles non-Error / non-object values without throwing', () => {
    expect(isTransientLLMError(undefined)).toBe(false);
    expect(isTransientLLMError(null)).toBe(false);
    expect(isTransientLLMError('terminated')).toBe(false);
    expect(isTransientLLMError(42)).toBe(false);
  });

  it('handles cycles in cause chains', () => {
    const a: any = new Error('a');
    const b: any = new Error('b');
    a.cause = b;
    b.cause = a;
    // Should not stack-overflow; both messages are non-transient.
    expect(isTransientLLMError(a)).toBe(false);
  });
});

describe('default retry schedule', () => {
  // Tyler review (#16454): lock the schedule so the stated "few-minute" budget
  // doesn't silently regress.

  const defaults = {
    maxRetries: 8,
    initialDelayMs: 1_000,
    backoffFactor: 2,
    maxDelayMs: 120_000,
  };

  it('has the expected default config', () => {
    expect(RETRY_CONFIG.maxRetries).toBe(defaults.maxRetries);
    expect(RETRY_CONFIG.initialDelayMs).toBe(defaults.initialDelayMs);
    expect(RETRY_CONFIG.backoffFactor).toBe(defaults.backoffFactor);
    expect(RETRY_CONFIG.maxDelayMs).toBe(defaults.maxDelayMs);
  });

  it('produces the expected pre-jitter schedule and total budget', () => {
    const originalJitter = RETRY_CONFIG.jitter;
    RETRY_CONFIG.jitter = 0;
    try {
      const expectedSchedule = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 120_000];
      const actualSchedule: number[] = [];
      for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
        actualSchedule.push(computeDelay(attempt));
      }
      expect(actualSchedule).toEqual(expectedSchedule);

      // Final retry delay must hit the configured cap.
      expect(actualSchedule[actualSchedule.length - 1]).toBe(RETRY_CONFIG.maxDelayMs);

      // ~247s total — i.e. the "few-minute" budget actually reaches minutes-scale.
      const totalBudgetMs = actualSchedule.reduce((a, b) => a + b, 0);
      expect(totalBudgetMs).toBe(247_000);
      expect(totalBudgetMs).toBeGreaterThanOrEqual(3 * 60_000);
      expect(totalBudgetMs).toBeLessThanOrEqual(8 * 60_000);
    } finally {
      RETRY_CONFIG.jitter = originalJitter;
    }
  });
});

describe('withRetry', () => {
  const originalConfig = { ...RETRY_CONFIG };

  beforeEach(() => {
    // Shrink the schedule so tests are fast — but keep relative shape.
    RETRY_CONFIG.initialDelayMs = 1;
    RETRY_CONFIG.maxDelayMs = 4;
    RETRY_CONFIG.backoffFactor = 2;
    RETRY_CONFIG.jitter = 0;
    RETRY_CONFIG.maxRetries = 3;
  });

  afterEach(() => {
    Object.assign(RETRY_CONFIG, originalConfig);
  });

  it('returns the value on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { label: 'test' })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient errors and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('terminated'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue('ok');

    await expect(withRetry(fn, { label: 'test' })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after maxRetries on persistent transient errors', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('terminated'));

    await expect(withRetry(fn, { label: 'test' })).rejects.toThrow('terminated');
    // initial + maxRetries
    expect(fn).toHaveBeenCalledTimes(RETRY_CONFIG.maxRetries + 1);
  });

  it('rethrows non-transient errors immediately without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('invalid api key'));

    await expect(withRetry(fn, { label: 'test' })).rejects.toThrow('invalid api key');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows AbortError immediately without retrying', async () => {
    const abortErr = new Error('cancelled');
    (abortErr as any).name = 'AbortError';
    const fn = vi.fn().mockRejectedValue(abortErr);

    await expect(withRetry(fn, { label: 'test' })).rejects.toBe(abortErr);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws when abortSignal is already aborted before the first attempt', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withRetry(fn, { label: 'test', abortSignal: controller.signal })).rejects.toThrow(/aborted/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('stops retrying once abortSignal fires mid-backoff', async () => {
    const controller = new AbortController();
    RETRY_CONFIG.initialDelayMs = 50;
    RETRY_CONFIG.maxDelayMs = 200;

    const fn = vi.fn().mockRejectedValue(new TypeError('terminated'));

    const promise = withRetry(fn, { label: 'test', abortSignal: controller.signal });
    // Let the first attempt fail, then abort during backoff.
    await new Promise(r => setTimeout(r, 10));
    controller.abort();

    await expect(promise).rejects.toThrow(/aborted/);
    // Exactly one attempt happened before we aborted the backoff wait.
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
