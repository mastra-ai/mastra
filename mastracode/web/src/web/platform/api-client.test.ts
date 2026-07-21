import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformApiClient, PlatformApiError } from './api-client.js';

const accessToken = 'platform-secret-token';

function client(fetchImpl: typeof fetch) {
  return new PlatformApiClient({ baseUrl: 'https://platform.example.com/', accessToken, fetchImpl });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PlatformApiClient', () => {
  it('uses bearer authentication without ambient cookie credentials', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );

    await expect(client(fetchImpl).request('POST', '/v1/test', { value: 1 })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://platform.example.com/v1/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: `Bearer ${accessToken}` }),
        body: JSON.stringify({ value: 1 }),
      }),
    );
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty('credentials');
  });

  it('propagates rate-limit status and retry timing', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Rate limited' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '17' },
      }),
    );

    const error = await client(fetchImpl)
      .request('GET', '/v1/test')
      .catch(caught => caught);
    expect(error).toBeInstanceOf(PlatformApiError);
    expect(error).toMatchObject({ message: 'Rate limited', status: 429, retryAfterSeconds: 17 });
  });

  it('redacts the access token from HTTP and transport errors', async () => {
    const httpFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: `Rejected Bearer ${accessToken}` }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const transportFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error(`socket failure for ${accessToken}`));

    await expect(client(httpFetch).request('GET', '/v1/test')).rejects.toMatchObject({
      message: 'Rejected Bearer [REDACTED]',
    });
    await expect(client(transportFetch).request('GET', '/v1/test')).rejects.toMatchObject({
      message: 'socket failure for [REDACTED]',
    });
  });

  it('honors a caller-supplied abort signal', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });

    const request = expect(
      client(fetchImpl).request('GET', '/v1/test', undefined, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(new DOMException('Cancelled', 'AbortError'));

    await request;
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('aborts stalled requests after 15 seconds', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => {
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), milliseconds);
      return controller.signal;
    });
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });

    const request = expect(client(fetchImpl).request('GET', '/v1/test')).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await request;
    expect(timeout).toHaveBeenCalledWith(15_000);
  });
});
