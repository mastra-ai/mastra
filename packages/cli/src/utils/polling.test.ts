import { describe, expect, it, vi } from 'vitest';

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

  it('rejects explicit cancellation errors', () => {
    expect(isRetryablePollingError(new DOMException('Cancelled', 'AbortError'))).toBe(false);
  });
});

describe('withPollingRetries', () => {
  it('continues retrying transient network errors', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' }))
      .mockResolvedValue('result');

    await expect(withPollingRetries(operation, 1)).resolves.toBe('result');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry explicit cancellation errors', async () => {
    const cancellation = new DOMException('Cancelled', 'AbortError');
    const operation = vi.fn().mockRejectedValue(cancellation);

    await expect(withPollingRetries(operation, 1)).rejects.toBe(cancellation);
    expect(operation).toHaveBeenCalledOnce();
  });

  it('does not start an operation when its signal is already aborted', async () => {
    const controller = new AbortController();
    const cancellation = new Error('Cancelled by caller');
    const operation = vi.fn().mockResolvedValue('result');
    controller.abort(cancellation);

    await expect(withPollingRetries(operation, 1, controller.signal)).rejects.toBe(cancellation);
    expect(operation).not.toHaveBeenCalled();
  });

  it('interrupts retry backoff when its signal is aborted', async () => {
    const controller = new AbortController();
    const cancellation = new Error('Cancelled during backoff');
    let markAttempted!: () => void;
    const attempted = new Promise<void>(resolve => {
      markAttempted = resolve;
    });
    const operation = vi.fn(async () => {
      markAttempted();
      throw Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
    });

    const result = withPollingRetries(operation, 1, controller.signal);
    await attempted;
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.abort(cancellation);

    await expect(result).rejects.toBe(cancellation);
    expect(operation).toHaveBeenCalledOnce();
  });
});
