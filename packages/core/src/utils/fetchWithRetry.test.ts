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
});
