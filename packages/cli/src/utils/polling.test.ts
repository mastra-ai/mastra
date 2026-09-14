import { afterEach, describe, expect, it, vi } from 'vitest';

import { isRetryablePollingError, withPollingRetries } from './polling';

describe('isRetryablePollingError', () => {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'];

  it.each(retryableCodes)('recognizes a top-level %s code', code => {
    expect(isRetryablePollingError({ code })).toBe(true);
  });

  it.each(retryableCodes)('recognizes a nested %s cause code', code => {
    expect(isRetryablePollingError({ cause: { code } })).toBe(true);
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
