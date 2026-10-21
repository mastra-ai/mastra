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

  describe('abort signal', () => {
    it('rejects immediately without fetching when the signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(fetchWithRetry('https://example.com', { signal: controller.signal })).rejects.toMatchObject({
        name: 'AbortError',
      });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops waiting and does not retry when aborted during backoff', async () => {
      const controller = new AbortController();
      mockFetch.mockResolvedValue(new Response('', { status: 503 }));

      const promise = fetchWithRetry('https://example.com', { signal: controller.signal });
      const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      await vi.advanceTimersByTimeAsync(250);
      expect(vi.getTimerCount()).toBe(1);

      controller.abort();
      await assertion;
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not retry when fetch rejects because the signal was aborted', async () => {
      const controller = new AbortController();
      mockFetch.mockImplementation(async () => {
        controller.abort();
        throw new DOMException('The operation was aborted.', 'AbortError');
      });

      await expect(fetchWithRetry('https://example.com', { signal: controller.signal })).rejects.toMatchObject({
        name: 'AbortError',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('propagates a custom abort reason', async () => {
      const controller = new AbortController();
      const reason = new Error('custom cancel');
      controller.abort(reason);

      await expect(fetchWithRetry('https://example.com', { signal: controller.signal })).rejects.toBe(reason);
    });

    it('removes the abort listener after a completed backoff', async () => {
      const controller = new AbortController();
      const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
      const ok = new Response('ok', { status: 200 });
      mockFetch.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(ok);

      const promise = fetchWithRetry('https://example.com', { signal: controller.signal });
      await flush();
      await expect(promise).resolves.toBe(ok);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });
  });

  describe('response body cleanup', () => {
    const streamingResponse = (status: number) => {
      const cancel = vi.fn();
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('x'));
          },
          cancel,
        }),
        { status },
      );
      return { response, cancel };
    };

    it('cancels a discarded error body and returns the successful response unread', async () => {
      const failed = streamingResponse(503);
      const ok = streamingResponse(200);
      mockFetch.mockResolvedValueOnce(failed.response).mockResolvedValueOnce(ok.response);

      const promise = fetchWithRetry('https://example.com', {}, 2);
      await flush();
      const res = await promise;

      expect(res).toBe(ok.response);
      expect(failed.cancel).toHaveBeenCalledTimes(1);
      expect(ok.cancel).not.toHaveBeenCalled();
      expect(res.bodyUsed).toBe(false);
    });

    it('cancels every error body when retries are exhausted', async () => {
      const first = streamingResponse(503);
      const second = streamingResponse(503);
      mockFetch.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);

      const promise = fetchWithRetry('https://example.com', {}, 2);
      const assertion = expect(promise).rejects.toThrow('Request failed with status: 503');
      await flush();
      await assertion;

      expect(first.cancel).toHaveBeenCalledTimes(1);
      expect(second.cancel).toHaveBeenCalledTimes(1);
    });

    it('cancels the error body when shouldRetryResponse returns false', async () => {
      const failed = streamingResponse(404);
      mockFetch.mockResolvedValueOnce(failed.response);

      await expect(
        fetchWithRetry('https://example.com', {}, 3, { shouldRetryResponse: r => r.status >= 500 }),
      ).rejects.toThrow('Request failed with status: 404');

      expect(failed.cancel).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('passes an unconsumed response to shouldRetryResponse', async () => {
      const failed = streamingResponse(500);
      mockFetch.mockResolvedValueOnce(failed.response);
      let bodyUsedInPredicate: boolean | undefined;
      let cancelledBeforePredicate: boolean | undefined;

      await expect(
        fetchWithRetry('https://example.com', {}, 3, {
          shouldRetryResponse: r => {
            bodyUsedInPredicate = r.bodyUsed;
            cancelledBeforePredicate = failed.cancel.mock.calls.length > 0;
            return false;
          },
        }),
      ).rejects.toThrow('Request failed with status: 500');

      expect(bodyUsedInPredicate).toBe(false);
      expect(cancelledBeforePredicate).toBe(false);
    });

    it('does not mask the status error when the predicate already consumed the body', async () => {
      const failed = streamingResponse(500);
      mockFetch.mockResolvedValueOnce(failed.response);

      await expect(
        fetchWithRetry('https://example.com', {}, 3, {
          shouldRetryResponse: r => {
            r.body!.getReader();
            return false;
          },
        }),
      ).rejects.toThrow('Request failed with status: 500');
    });

    it('handles error responses without a body', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const promise = fetchWithRetry('https://example.com', {}, 2);
      await flush();
      const res = await promise;
      expect(res.ok).toBe(true);
    });
  });
});
