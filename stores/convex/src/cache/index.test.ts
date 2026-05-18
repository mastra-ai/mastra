import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CacheRequest } from './types';
import type { ConvexCacheClient } from './index';
import { ConvexServerCache } from './index';

class MockConvexCacheClient {
  calls: CacheRequest[] = [];
  rawResponses: Array<{ result: unknown; hasMore?: boolean }> = [];

  async callCache<T = unknown>(request: CacheRequest): Promise<T> {
    this.calls.push(request);
    return undefined as T;
  }

  async callCacheRaw<T = unknown>(request: CacheRequest): Promise<{ result: T; hasMore?: boolean }> {
    this.calls.push(request);
    return (this.rawResponses.shift() ?? { result: undefined }) as { result: T; hasMore?: boolean };
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
});
