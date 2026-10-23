import { afterEach, describe, expect, it, vi } from 'vitest';

import { isRetryablePollingError, withPollingRetries } from './polling';

describe('isRetryablePollingError', () => {
  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'EAI_AGAIN',
    'EPIPE',
    'UND_ERR_SOCKET',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
  ];

  it.each(retryableCodes)('recognizes a top-level %s code', code => {
    expect(isRetryablePollingError({ code })).toBe(true);
  });

  it.each(retryableCodes)('recognizes a nested %s cause code', code => {
    expect(isRetryablePollingError({ cause: { code } })).toBe(true);
  });

  it.each(['ERR_INVALID_URL', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT'])(
    'does not mask a permanent %s cause with the generic fetch message',
    code => {
      expect(isRetryablePollingError(new TypeError('fetch failed', { cause: { code } }))).toBe(false);
    },
  );

  it('recognizes a dropped fetch body from its underlying socket error', () => {
    expect(isRetryablePollingError(new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET' } }))).toBe(true);
  });

  it('rejects unclassified programming errors', () => {
    expect(isRetryablePollingError(new Error('unexpected extra poll'))).toBe(false);
  });

  it('rejects unsupported error codes', () => {
    expect(isRetryablePollingError({ code: 'EINVAL' })).toBe(false);
  });

  it('treats AbortError (DOMException) as terminal', () => {
    expect(isRetryablePollingError(new DOMException('Cancelled', 'AbortError'))).toBe(false);
  });

  it('treats an AbortError-named object as terminal', () => {
    expect(isRetryablePollingError({ name: 'AbortError' })).toBe(false);
  });
});

describe('withPollingRetries', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('notifies before each retry with the attempt and capped delay, but not on exhaustion', async () => {
    vi.useFakeTimers();
    const error = new TypeError('fetch failed');
    const onRetry = vi.fn();
    const assertion = expect(
      withPollingRetries(vi.fn().mockRejectedValue(error), {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 150,
        onRetry,
      }),
    ).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(0);
    expect(onRetry.mock.calls).toEqual([[error, 1, 100]]);
    await vi.runAllTimersAsync();
    await assertion;
    expect(onRetry.mock.calls).toEqual([
      [error, 1, 100],
      [error, 2, 150],
      [error, 3, 150],
    ]);
  });

  it.each(['terminal', 'aborted'])('does not announce a retry for a %s operation', async kind => {
    const controller = new AbortController();
    const error = new Error('not retryable');
    const onRetry = vi.fn();
    if (kind === 'aborted') controller.abort(error);
    await expect(
      withPollingRetries(
        async () => {
          throw error;
        },
        { onRetry },
        controller.signal,
      ),
    ).rejects.toBe(error);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('propagates an AbortError immediately with a single call and no delay', async () => {
    let calls = 0;
    const cancellation = new DOMException('Cancelled', 'AbortError');

    await expect(
      withPollingRetries(async () => {
        calls += 1;
        throw cancellation;
      }, 1),
    ).rejects.toBe(cancellation);

    expect(calls).toBe(1);
  });

  it('rejects without calling fn when the signal is already aborted', async () => {
    let calls = 0;
    const controller = new AbortController();
    controller.abort();

    await expect(
      withPollingRetries(
        async () => {
          calls += 1;
          return 'ok';
        },
        3,
        controller.signal,
      ),
    ).rejects.toBe(controller.signal.reason);

    expect(calls).toBe(0);
  });

  it('interrupts an in-flight backoff when the signal aborts', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const controller = new AbortController();

    const promise = withPollingRetries(
      async () => {
        calls += 1;
        throw { code: 'ECONNRESET' };
      },
      3,
      controller.signal,
    );
    promise.catch(() => {});

    await Promise.resolve();
    expect(calls).toBe(1);

    controller.abort();
    await expect(promise).rejects.toBe(controller.signal.reason);
    expect(calls).toBe(1);
  });

  it.each([undefined, {}])('preserves default retry limits and delays with options %j', async options => {
    vi.useFakeTimers();
    const error = new TypeError('fetch failed');
    const fn = vi.fn().mockRejectedValue(error);
    const assertion = expect(withPollingRetries(fn, options)).rejects.toBe(error);

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    for (const [index, ms] of [500, 1000, 2000].entries()) {
      await vi.advanceTimersByTimeAsync(ms - 1);
      expect(fn).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(index + 2);
    }
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses custom classification and capped exponential delays', async () => {
    vi.useFakeTimers();
    const error = new Error('temporary HTTP failure');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok');
    const shouldRetry = vi.fn(value => value === error);
    const promise = withPollingRetries(fn, {
      initialDelayMs: 2000,
      maxDelayMs: 3000,
      shouldRetry,
    });

    await vi.advanceTimersByTimeAsync(0);
    for (const [index, ms] of [2000, 3000, 3000].entries()) {
      await vi.advanceTimersByTimeAsync(ms - 1);
      expect(fn).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(index + 2);
    }
    await expect(promise).resolves.toBe('ok');
    expect(shouldRetry).toHaveBeenCalledTimes(3);
  });

  it.each([Infinity, { maxRetries: Infinity }])('rejects unlimited retries without a signal: %j', async retries => {
    const fn = vi.fn();
    await expect(withPollingRetries(fn, retries)).rejects.toThrow('Unlimited polling retries require an AbortSignal');
    expect(fn).not.toHaveBeenCalled();
  });

  it('stops unlimited retries at a deadline signal and removes pending timers', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const deadline = new Error('deadline exceeded');
    const fn = vi.fn().mockRejectedValue(new Error('retry'));
    const timeout = setTimeout(() => controller.abort(deadline), 1250);
    const assertion = expect(
      withPollingRetries(
        fn,
        {
          maxRetries: Infinity,
          shouldRetry: () => true,
        },
        controller.signal,
      ),
    ).rejects.toBe(deadline);

    await vi.advanceTimersByTimeAsync(1250);
    await assertion;
    clearTimeout(timeout);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not retry errors rejected by the custom classifier', async () => {
    const error = new TypeError('fetch failed');
    const fn = vi.fn().mockRejectedValue(error);
    await expect(withPollingRetries(fn, { shouldRetry: () => false })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable network errors and eventually succeeds', async () => {
    vi.useFakeTimers();
    let calls = 0;

    const promise = withPollingRetries(async () => {
      calls += 1;
      if (calls < 3) {
        throw { code: 'ECONNRESET' };
      }
      return 'ok';
    }, 3);

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(calls).toBe(3);
  });
});
