import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisServerCache, upstashPreset, nodeRedisPreset, LIST_PUSH_INDEXED_SCRIPT } from './index';
import type { RedisClient } from './index';

// Create a mock Redis client
function createMockClient(): RedisClient & { [key: string]: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(),
    set: vi.fn(),
    llen: vi.fn(),
    rpush: vi.fn(),
    lrange: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
    scan: vi.fn(),
    incr: vi.fn(),
    eval: vi.fn(),
  };
}

describe('RedisServerCache', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let cache: RedisServerCache;

  beforeEach(() => {
    mockClient = createMockClient();
    cache = new RedisServerCache({ client: mockClient });
  });

  describe('get', () => {
    it('should get a value with prefixed key and deserialize JSON', async () => {
      // Redis returns JSON string, cache deserializes it
      mockClient.get.mockResolvedValue('{"foo":"bar"}');

      const result = await cache.get('test-key');

      expect(mockClient.get).toHaveBeenCalledWith('mastra:cache:test-key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent key', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await cache.get('non-existent');

      expect(result).toBeNull();
    });

    it('should return plain string if not valid JSON', async () => {
      mockClient.get.mockResolvedValue('plain-string');

      const result = await cache.get('test-key');

      expect(result).toBe('plain-string');
    });
  });

  describe('set', () => {
    it('should set a value with TTL by default (ioredis style) and serialize to JSON', async () => {
      mockClient.set.mockResolvedValue('OK');

      await cache.set('test-key', { foo: 'bar' });

      // Default uses ioredis style: set(key, serialized-value, 'EX', seconds)
      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', '{"foo":"bar"}', 'EX', 300);
    });

    it('should set without TTL when ttlSeconds is 0', async () => {
      const noTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 0 });
      mockClient.set.mockResolvedValue('OK');

      await noTtlCache.set('test-key', { foo: 'bar' });

      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', '{"foo":"bar"}');
    });

    it('should use custom TTL when specified', async () => {
      const customTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 600 });
      mockClient.set.mockResolvedValue('OK');

      await customTtlCache.set('test-key', { foo: 'bar' });

      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', '{"foo":"bar"}', 'EX', 600);
    });
  });

  describe('listLength', () => {
    it('should return list length', async () => {
      mockClient.llen.mockResolvedValue(5);

      const result = await cache.listLength('my-list');

      expect(mockClient.llen).toHaveBeenCalledWith('mastra:cache:my-list');
      expect(result).toBe(5);
    });
  });

  describe('listPush', () => {
    it('should push serialized value to list and refresh TTL', async () => {
      mockClient.rpush.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(1);

      await cache.listPush('my-list', { event: 'test' });

      expect(mockClient.rpush).toHaveBeenCalledWith('mastra:cache:my-list', '{"event":"test"}');
      expect(mockClient.expire).toHaveBeenCalledWith('mastra:cache:my-list', 300);
    });

    it('should not refresh TTL when ttlSeconds is 0', async () => {
      const noTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 0 });
      mockClient.rpush.mockResolvedValue(1);

      await noTtlCache.listPush('my-list', { event: 'test' });

      expect(mockClient.rpush).toHaveBeenCalledWith('mastra:cache:my-list', '{"event":"test"}');
      expect(mockClient.expire).not.toHaveBeenCalled();
    });
  });

  describe('listFromTo', () => {
    it('should get range from list and deserialize items', async () => {
      // Redis returns JSON strings, cache deserializes them
      const storedEvents = ['{"id":"1"}', '{"id":"2"}', '{"id":"3"}'];
      mockClient.lrange.mockResolvedValue(storedEvents);

      const result = await cache.listFromTo('my-list', 0, 2);

      expect(mockClient.lrange).toHaveBeenCalledWith('mastra:cache:my-list', 0, 2);
      expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    });

    it('should use -1 as default end index', async () => {
      mockClient.lrange.mockResolvedValue([]);

      await cache.listFromTo('my-list', 0);

      expect(mockClient.lrange).toHaveBeenCalledWith('mastra:cache:my-list', 0, -1);
    });
  });

  describe('increment', () => {
    it('should increment with prefixed key and refresh TTL', async () => {
      mockClient.incr.mockResolvedValue(3);
      mockClient.expire.mockResolvedValue(1);

      const result = await cache.increment('counter');

      expect(mockClient.incr).toHaveBeenCalledWith('mastra:cache:counter');
      expect(mockClient.expire).toHaveBeenCalledWith('mastra:cache:counter', 300);
      expect(result).toBe(3);
    });

    it('should not refresh TTL when ttlSeconds is 0', async () => {
      const noTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 0 });
      mockClient.incr.mockResolvedValue(1);

      const result = await noTtlCache.increment('counter');

      expect(mockClient.incr).toHaveBeenCalledWith('mastra:cache:counter');
      expect(mockClient.expire).not.toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('listPushIndexed', () => {
    it('runs one Lua script instead of INCR/EXPIRE/RPUSH/EXPIRE', async () => {
      mockClient.eval.mockResolvedValue(4);

      const index = await cache.listPushIndexed('events', 'events:counter', { type: 'chunk', data: { a: 1 } });

      expect(index).toBe(4);
      expect(mockClient.eval).toHaveBeenCalledTimes(1);
      expect(mockClient.eval).toHaveBeenCalledWith(
        LIST_PUSH_INDEXED_SCRIPT,
        2,
        'mastra:cache:events',
        'mastra:cache:events:counter',
        '{"type":"chunk","data":{"a":1}}',
        '300',
      );
      expect(mockClient.incr).not.toHaveBeenCalled();
      expect(mockClient.rpush).not.toHaveBeenCalled();
      expect(mockClient.expire).not.toHaveBeenCalled();
    });

    it('strips a pre-existing index from the value and passes ttl 0 through', async () => {
      const noTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 0 });
      mockClient.eval.mockResolvedValue('0');

      const index = await noTtlCache.listPushIndexed('events', 'events:counter', { index: 99, type: 'x' });

      expect(index).toBe(0);
      expect(mockClient.eval.mock.calls[0]!.slice(4)).toEqual(['{"type":"x"}', '0']);
    });

    it('falls back to increment + listPush when the client has no eval', async () => {
      const { eval: _eval, ...clientWithoutEval } = mockClient;
      const fallbackCache = new RedisServerCache({ client: clientWithoutEval as RedisClient });
      mockClient.incr.mockResolvedValue(3);
      mockClient.rpush.mockResolvedValue(3);

      const index = await fallbackCache.listPushIndexed('events', 'events:counter', { type: 'x' });

      expect(index).toBe(2);
      expect(mockClient.incr).toHaveBeenCalledWith('mastra:cache:events:counter');
      expect(mockClient.rpush).toHaveBeenCalledWith('mastra:cache:events', '{"type":"x","index":2}');
      expect(mockClient.expire).toHaveBeenCalledTimes(2);
    });

    it('permanently falls back after a CROSSSLOT rejection (Redis Cluster)', async () => {
      mockClient.eval.mockRejectedValue(new Error("CROSSSLOT Keys in request don't hash to the same slot"));
      mockClient.incr.mockResolvedValue(1);
      mockClient.rpush.mockResolvedValue(1);

      expect(await cache.listPushIndexed('events', 'events:counter', { type: 'x' })).toBe(0);
      expect(mockClient.eval).toHaveBeenCalledTimes(1);
      expect(mockClient.rpush).toHaveBeenCalledWith('mastra:cache:events', '{"type":"x","index":0}');

      mockClient.incr.mockResolvedValue(2);
      expect(await cache.listPushIndexed('events', 'events:counter', { type: 'y' })).toBe(1);
      // No second eval attempt once scripting is known to be unusable
      expect(mockClient.eval).toHaveBeenCalledTimes(1);
    });

    it('rethrows non-CROSSSLOT script errors', async () => {
      mockClient.eval.mockRejectedValue(new Error('connection lost'));
      await expect(cache.listPushIndexed('events', 'events:counter', { type: 'x' })).rejects.toThrow('connection lost');
      expect(mockClient.incr).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      mockClient.del.mockResolvedValue(1);

      await cache.delete('test-key');

      expect(mockClient.del).toHaveBeenCalledWith('mastra:cache:test-key');
    });
  });

  describe('clear', () => {
    it('should scan and delete all keys with prefix', async () => {
      // First scan returns some keys, second returns empty
      mockClient.scan
        .mockResolvedValueOnce(['5', ['mastra:cache:key1', 'mastra:cache:key2']])
        .mockResolvedValueOnce(['0', []]);
      mockClient.del.mockResolvedValue(2);

      await cache.clear();

      expect(mockClient.scan).toHaveBeenCalledWith('0', 'MATCH', 'mastra:cache:*', 'COUNT', 100);
      expect(mockClient.del).toHaveBeenCalledWith('mastra:cache:key1', 'mastra:cache:key2');
    });

    it('should handle empty cache', async () => {
      mockClient.scan.mockResolvedValue(['0', []]);

      await cache.clear();

      expect(mockClient.scan).toHaveBeenCalled();
      expect(mockClient.del).not.toHaveBeenCalled();
    });

    it('should handle numeric cursor (for ioredis compatibility)', async () => {
      mockClient.scan.mockResolvedValueOnce([5, ['mastra:cache:key1']]).mockResolvedValueOnce([0, []]);
      mockClient.del.mockResolvedValue(1);

      await cache.clear();

      expect(mockClient.del).toHaveBeenCalledWith('mastra:cache:key1');
    });
  });

  describe('key prefix', () => {
    it('should use custom key prefix', async () => {
      const customCache = new RedisServerCache({ client: mockClient }, { keyPrefix: 'myapp:' });
      mockClient.get.mockResolvedValue('value');

      await customCache.get('test-key');

      expect(mockClient.get).toHaveBeenCalledWith('myapp:test-key');
    });
  });

  describe('upstashPreset', () => {
    it('should use upstash-style set with expiry', async () => {
      const upstashCache = new RedisServerCache({ client: mockClient }, upstashPreset);
      mockClient.set.mockResolvedValue('OK');

      await upstashCache.set('test-key', 'value');

      // Upstash uses { ex: seconds } style, value is serialized to JSON
      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', '"value"', { ex: 300 });
    });

    it('should use upstash-style scan', async () => {
      const upstashCache = new RedisServerCache({ client: mockClient }, upstashPreset);
      mockClient.scan.mockResolvedValue(['0', []]);

      await upstashCache.clear();

      // Upstash uses { match, count } style
      expect(mockClient.scan).toHaveBeenCalledWith('0', { match: 'mastra:cache:*', count: 100 });
    });

    it('should use upstash-style eval(script, keys, args)', async () => {
      const upstashCache = new RedisServerCache({ client: mockClient }, upstashPreset);
      mockClient.eval.mockResolvedValue(0);

      await upstashCache.listPushIndexed('events', 'events:counter', { type: 'x' });

      expect(mockClient.eval).toHaveBeenCalledWith(
        LIST_PUSH_INDEXED_SCRIPT,
        ['mastra:cache:events', 'mastra:cache:events:counter'],
        ['{"type":"x"}', '300'],
      );
    });
  });

  describe('nodeRedisPreset', () => {
    it('should use node-redis-style set with expiry', async () => {
      const nodeCache = new RedisServerCache({ client: mockClient }, nodeRedisPreset);
      mockClient.set.mockResolvedValue('OK');

      await nodeCache.set('test-key', 'value');

      // node-redis uses { EX: seconds } style, value is serialized to JSON
      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', '"value"', { EX: 300 });
    });

    it('should use node-redis-style scan', async () => {
      const nodeCache = new RedisServerCache({ client: mockClient }, nodeRedisPreset);
      mockClient.scan.mockResolvedValue(['0', []]);

      await nodeCache.clear();

      // node-redis uses { MATCH, COUNT } style
      expect(mockClient.scan).toHaveBeenCalledWith('0', { MATCH: 'mastra:cache:*', COUNT: 100 });
    });

    it('routes list length through lLen (camelCase) on node-redis clients', async () => {
      const nodeMock: any = { ...createMockClient(), lLen: vi.fn().mockResolvedValue(7) };
      const nodeCache = new RedisServerCache({ client: nodeMock }, nodeRedisPreset);

      const result = await nodeCache.listLength('my-list');

      expect(result).toBe(7);
      expect(nodeMock.lLen).toHaveBeenCalledWith('mastra:cache:my-list');
      expect(nodeMock.llen).not.toHaveBeenCalled();
    });

    it('routes list push through rPush (camelCase) on node-redis clients', async () => {
      const nodeMock: any = { ...createMockClient(), rPush: vi.fn().mockResolvedValue(1) };
      const nodeCache = new RedisServerCache({ client: nodeMock }, nodeRedisPreset);

      await nodeCache.listPush('my-list', { event: 'test' });

      expect(nodeMock.rPush).toHaveBeenCalledWith('mastra:cache:my-list', '{"event":"test"}');
      expect(nodeMock.rpush).not.toHaveBeenCalled();
    });

    it('routes list range through lRange (camelCase) on node-redis clients', async () => {
      const nodeMock: any = {
        ...createMockClient(),
        lRange: vi.fn().mockResolvedValue(['"a"', '"b"']),
      };
      const nodeCache = new RedisServerCache({ client: nodeMock }, nodeRedisPreset);

      const result = await nodeCache.listFromTo('my-list', 0, -1);

      expect(result).toEqual(['a', 'b']);
      expect(nodeMock.lRange).toHaveBeenCalledWith('mastra:cache:my-list', 0, -1);
      expect(nodeMock.lrange).not.toHaveBeenCalled();
    });

    it('should use node-redis-style eval(script, { keys, arguments })', async () => {
      const nodeCache = new RedisServerCache({ client: mockClient }, nodeRedisPreset);
      mockClient.eval.mockResolvedValue(0);

      await nodeCache.listPushIndexed('events', 'events:counter', { type: 'x' });

      expect(mockClient.eval).toHaveBeenCalledWith(LIST_PUSH_INDEXED_SCRIPT, {
        keys: ['mastra:cache:events', 'mastra:cache:events:counter'],
        arguments: ['{"type":"x"}', '300'],
      });
    });
  });
});
