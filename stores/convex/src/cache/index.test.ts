import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CacheRequest } from './types';
import { ConvexCacheClient, ConvexServerCache } from './index';

class MockConvexCacheClient {
  calls: CacheRequest[] = [];
  rawResponses: Array<{ result: unknown; hasMore?: boolean } | Error> = [];

  async callCache<T = unknown>(request: CacheRequest): Promise<T> {
    this.calls.push(request);
    return undefined as T;
  }

  async callCacheRaw<T = unknown>(request: CacheRequest): Promise<{ result: T; hasMore?: boolean }> {
    this.calls.push(request);
    const response = this.rawResponses.shift() ?? { result: undefined };
    if (response instanceof Error) throw response;
    return response as { result: T; hasMore?: boolean };
  }
}

describe('ConvexServerCache', () => {
  let client: MockConvexCacheClient;
  let cache: ConvexServerCache;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    client = new MockConvexCacheClient();
    cache = new ConvexServerCache({ client: client as unknown as ConvexCacheClient });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes scalar values with prefixed keys and default TTL', async () => {
    await cache.set('run:1', { status: 'streaming' });

    expect(client.calls).toEqual([
      {
        op: 'set',
        key: 'mastra:cache:run:1',
        keyPrefix: 'mastra:cache:',
        value: { status: 'streaming' },
        expiresAt: Date.now() + 300_000,
      },
    ]);
  });

  it('supports custom prefixes and disabled TTL', async () => {
    cache = new ConvexServerCache({
      client: client as unknown as ConvexCacheClient,
      keyPrefix: 'tenant-a:',
      ttlMs: 0,
    });

    await cache.listPush('events', { id: 'evt-1' });

    expect(client.calls).toEqual([
      {
        op: 'listPush',
        key: 'tenant-a:events',
        keyPrefix: 'tenant-a:',
        value: { id: 'evt-1' },
        expiresAt: null,
      },
    ]);
  });

  it('uses Redis-compatible inclusive list ranges', async () => {
    await cache.listFromTo('events', 5, 10);

    expect(client.calls).toEqual([
      {
        op: 'listFromTo',
        key: 'mastra:cache:events',
        from: 5,
        to: 10,
      },
    ]);
  });

  it('loops delete and clear while the server reports remaining rows', async () => {
    client.rawResponses = [{ result: undefined, hasMore: true }, { result: undefined }];

    await cache.delete('events');

    expect(client.calls).toEqual([
      { op: 'delete', key: 'mastra:cache:events' },
      { op: 'delete', key: 'mastra:cache:events' },
    ]);

    client.calls = [];
    client.rawResponses = [{ result: undefined, hasMore: true }, { result: undefined }];

    await cache.clear();

    expect(client.calls).toEqual([
      { op: 'clear', keyPrefix: 'mastra:cache:' },
      { op: 'clear', keyPrefix: 'mastra:cache:' },
    ]);
  });

  it('loops listPush while cleanup is still settling', async () => {
    client.rawResponses = [{ result: undefined, hasMore: true }, { result: undefined }];

    await cache.listPush('events', { id: 'evt-1' });

    expect(client.calls).toEqual([
      {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: { id: 'evt-1' },
        expiresAt: Date.now() + 300_000,
      },
      {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: { id: 'evt-1' },
        expiresAt: Date.now() + 300_000,
      },
    ]);
  });

  it('allocates indexed list entries in one request, honouring a longer ttlMs', async () => {
    client.rawResponses = [{ result: 0 }, { result: 1 }];

    await expect(cache.listPushIndexed('log', 'log:counter', { id: 'evt-1', index: 7 })).resolves.toBe(0);
    await expect(cache.listPushIndexed('log', 'log:counter', { id: 'evt-2' }, 3_600_000)).resolves.toBe(1);

    expect(client.calls).toEqual([
      {
        op: 'listPushIndexed',
        key: 'mastra:cache:log',
        counterKey: 'mastra:cache:log:counter',
        keyPrefix: 'mastra:cache:',
        value: { id: 'evt-1' },
        expiresAt: Date.now() + 300_000,
      },
      {
        op: 'listPushIndexed',
        key: 'mastra:cache:log',
        counterKey: 'mastra:cache:log:counter',
        keyPrefix: 'mastra:cache:',
        value: { id: 'evt-2' },
        expiresAt: Date.now() + 3_600_000,
      },
    ]);
  });

  it('keeps indexed list entries without expiry when TTL is disabled', async () => {
    cache = new ConvexServerCache({ client: client as unknown as ConvexCacheClient, ttlMs: 0 });

    await cache.listPushIndexed('log', 'log:counter', { id: 'evt-1' }, 3_600_000);

    expect(client.calls).toEqual([expect.objectContaining({ op: 'listPushIndexed', expiresAt: null })]);
  });

  it('falls back to increment + listPush when the deployed handler lacks listPushIndexed', async () => {
    client.rawResponses = [
      new Error('Unsupported operation listPushIndexed'),
      { result: 1 },
      { result: undefined },
      { result: 2 },
      { result: undefined },
    ];

    await expect(cache.listPushIndexed('log', 'log:counter', { id: 'evt-1' })).resolves.toBe(0);
    await expect(cache.listPushIndexed('log', 'log:counter', { id: 'evt-2' })).resolves.toBe(1);

    expect(client.calls.map(call => call.op)).toEqual([
      'listPushIndexed',
      'increment',
      'listPush',
      'increment',
      'listPush',
    ]);
  });

  it('propagates other listPushIndexed failures', async () => {
    client.rawResponses = [new Error('Convex cache request timed out after 30000 ms.')];

    await expect(cache.listPushIndexed('log', 'log:counter', { id: 'evt-1' })).rejects.toThrow('timed out');
    expect(client.calls).toHaveLength(1);
  });
});

describe('ConvexCacheClient', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('times out hung Convex mutation requests', async () => {
    vi.useFakeTimers();

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }),
    );

    const client = new ConvexCacheClient({
      deploymentUrl: 'https://example.convex.cloud',
      adminAuthToken: 'token',
      requestTimeoutMs: 1,
    });

    const call = client.callCacheRaw({ op: 'get', key: 'key' });
    const assertion = expect(call).rejects.toThrow('Convex cache request timed out after 1 ms.');
    await vi.advanceTimersByTimeAsync(1);

    await assertion;
  });

  it('passes Convex mutation requests through with an abort signal', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ value: { ok: true, result: 'cached' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ConvexCacheClient({
      deploymentUrl: 'https://example.convex.cloud/',
      adminAuthToken: 'token',
    });

    await expect(client.callCache({ op: 'get', key: 'key' })).resolves.toBe('cached');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.convex.cloud/api/mutation',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('normalizes config values before sending requests', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ value: { ok: true, result: 'cached' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ConvexCacheClient({
      deploymentUrl: ' https://example.convex.cloud/// ',
      adminAuthToken: ' token ',
      cacheFunction: ' ',
    });

    await client.callCache({ op: 'get', key: 'key' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.convex.cloud/api/mutation',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Convex token',
        }),
        body: JSON.stringify({
          path: 'mastra/cache:handle',
          args: { op: 'get', key: 'key' },
          format: 'json',
        }),
      }),
    );
  });

  it('rejects blank required config values', () => {
    expect(
      () =>
        new ConvexCacheClient({
          deploymentUrl: ' ',
          adminAuthToken: 'token',
        }),
    ).toThrow('ConvexCacheClient: deploymentUrl is required.');

    expect(
      () =>
        new ConvexCacheClient({
          deploymentUrl: 'https://example.convex.cloud',
          adminAuthToken: ' ',
        }),
    ).toThrow('ConvexCacheClient: adminAuthToken is required.');
  });

  it('throws non-2xx Convex API errors with status text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      })),
    );

    const client = new ConvexCacheClient({
      deploymentUrl: 'https://example.convex.cloud',
      adminAuthToken: 'token',
    });

    await expect(client.callCache({ op: 'get', key: 'key' })).rejects.toThrow(
      'Convex API error: 503 service unavailable',
    );
  });

  it('propagates top-level Convex errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'error',
          errorMessage: 'mutation failed',
          code: 'ConvexMutationFailed',
          details: { retryable: false },
        }),
      })),
    );

    const client = new ConvexCacheClient({
      deploymentUrl: 'https://example.convex.cloud',
      adminAuthToken: 'token',
    });

    await expect(client.callCache({ op: 'get', key: 'key' })).rejects.toMatchObject({
      message: 'mutation failed',
      code: 'ConvexMutationFailed',
      details: { retryable: false },
    });
  });

  it('propagates nested cache errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          value: {
            ok: false,
            error: 'Wrong cache value type',
            code: 'CACHE_TYPE_CONFLICT',
            details: { expected: 'list', actual: 'value' },
          },
        }),
      })),
    );

    const client = new ConvexCacheClient({
      deploymentUrl: 'https://example.convex.cloud',
      adminAuthToken: 'token',
    });

    await expect(client.callCache({ op: 'listLength', key: 'key' })).rejects.toMatchObject({
      message: 'Wrong cache value type',
      code: 'CACHE_TYPE_CONFLICT',
      details: { expected: 'list', actual: 'value' },
    });
  });
});
