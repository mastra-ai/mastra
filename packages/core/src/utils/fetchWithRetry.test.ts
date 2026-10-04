import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from './fetchWithRetry';

describe('fetchWithRetry', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const flush = async () => {
    // Run scheduled timers + pending microtasks until the queue settles.
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
      if (vi.getTimerCount() > 0) {
        vi.advanceTimersByTime(20000);
      }
      await Promise.resolve();
    }
  };

  it('returns the response immediately when fetch succeeds', async () => {
    const ok = new Response('ok', { status: 200 });
    mockFetch.mockResolvedValue(ok);

    const result = fetchWithRetry('https://example.com');
    const res = await result;
    expect(res).toBe(ok);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on network failure up to maxRetries then throws', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockFetch
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError);

    const promise = fetchWithRetry('https://example.com', {}, 3);
    await flush();
    await expect(promise).rejects.toThrow('Failed to fetch');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('retries on non-OK response status then succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Internal Server Error' }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = fetchWithRetry('https://example.com', {}, 3);
    await flush();
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws immediately when shouldRetryResponse returns false', async () => {
    const notOk = new Response('', { status: 400, statusText: 'Bad Request' });
    mockFetch.mockResolvedValue(notOk);

    const promise = fetchWithRetry('https://example.com', {}, 3, {
      shouldRetryResponse: () => false,
    });
    await flush();
    await expect(promise).rejects.toThrow('Request failed with status: 400');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries on persistent non-OK status', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 503, statusText: 'Service Unavailable' }));

    const promise = fetchWithRetry('https://example.com', {}, 2);
    await flush();
    await expect(promise).rejects.toThrow('Request failed with status: 503');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('wraps non-Error thrown values as Errors', async () => {
    mockFetch.mockRejectedValueOnce('string error');

    const promise = fetchWithRetry('https://example.com', {}, 1);
    await flush();
    await expect(promise).rejects.toBeInstanceOf(Error);
  });

  it('passes url and options through to fetch', async () => {
    const ok = new Response('ok', { status: 200 });
    mockFetch.mockResolvedValue(ok);

    const opts: RequestInit = { method: 'POST', headers: { 'x-test': '1' } };
    await fetchWithRetry('https://example.com', opts);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com', opts);
  });

  it('rejects an already-aborted signal without fetching or scheduling a retry', async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetch.mockRejectedValue(controller.signal.reason);

    const promise = fetchWithRetry('https://example.com', { signal: controller.signal });
    const rejection = expect(promise).rejects.toBe(controller.signal.reason);
    await flush();
    await rejection;
    expect(mockFetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves a custom cancellation reason when aborting an in-flight fetch', async () => {
    const controller = new AbortController();
    const reason = { message: 'Cancelled by caller' };
    mockFetch.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
        }),
    );

    const promise = fetchWithRetry('https://example.com', { signal: controller.signal });
    const rejection = expect(promise).rejects.toBe(reason);
    controller.abort(reason);
    mockFetch.mockRejectedValue(reason);
    await flush();
    await rejection;
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['network failure', 'HTTP 503'])('interrupts backoff after %s and cleans up', async failure => {
    const controller = new AbortController();
    const reason = new DOMException('Cancelled during backoff', 'AbortError');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    if (failure === 'network failure') {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    } else {
      mockFetch.mockResolvedValue(new Response('', { status: 503 }));
    }

    const promise = fetchWithRetry('https://example.com', { signal: controller.signal });
    const rejection = expect(promise).rejects.toBe(reason);
    // Let fetch settle and enter backoff without advancing the clock.
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort(reason);
    const pendingTimersAfterAbort = vi.getTimerCount();
    mockFetch.mockRejectedValue(reason);
    await flush();
    await rejection;
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(pendingTimersAfterAbort).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('stops when the retry predicate aborts the request before backoff', async () => {
    const controller = new AbortController();
    const reason = new Error('Cancelled in retry predicate');
    mockFetch.mockResolvedValue(new Response('', { status: 503 }));

    const promise = fetchWithRetry('https://example.com', { signal: controller.signal }, 3, {
      shouldRetryResponse: () => {
        controller.abort(reason);
        return true;
      },
    });
    const rejection = expect(promise).rejects.toBe(reason);
    await flush();
    await rejection;
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps normal backoff timing with a signal and removes its listener after waiting', async () => {
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, 'addEventListener');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const ok = new Response('ok');
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok);

    const promise = fetchWithRetry('https://example.com', { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(1999);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe(ok);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    const listener = addListener.mock.calls.find(([type]) => type === 'abort')?.[1];
    expect(listener).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith('abort', listener);
    controller.abort();
    await expect(promise).resolves.toBe(ok);
  });
});
