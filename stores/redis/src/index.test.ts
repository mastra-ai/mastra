import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisServerCache, upstashPreset, nodeRedisPreset, type RedisClient } from './index';

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
    it('should get a value with prefixed key', async () => {
      mockClient.get.mockResolvedValue({ foo: 'bar' });

      const result = await cache.get('test-key');

      expect(mockClient.get).toHaveBeenCalledWith('mastra:cache:test-key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent key', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await cache.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set a value with TTL by default (ioredis style)', async () => {
      mockClient.set.mockResolvedValue('OK');

      await cache.set('test-key', { foo: 'bar' });

      // Default uses ioredis style: set(key, value, 'EX', seconds)
      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', { foo: 'bar' }, 'EX', 300);
    });

    it('should set without TTL when ttlSeconds is 0', async () => {
      const noTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 0 });
      mockClient.set.mockResolvedValue('OK');

      await noTtlCache.set('test-key', { foo: 'bar' });

      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', { foo: 'bar' });
    });

    it('should use custom TTL when specified', async () => {
      const customTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 600 });
      mockClient.set.mockResolvedValue('OK');

      await customTtlCache.set('test-key', { foo: 'bar' });

      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', { foo: 'bar' }, 'EX', 600);
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
    it('should push value to list and refresh TTL', async () => {
      mockClient.rpush.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(1);

      await cache.listPush('my-list', { event: 'test' });

      expect(mockClient.rpush).toHaveBeenCalledWith('mastra:cache:my-list', { event: 'test' });
      expect(mockClient.expire).toHaveBeenCalledWith('mastra:cache:my-list', 300);
    });

    it('should not refresh TTL when ttlSeconds is 0', async () => {
      const noTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 0 });
      mockClient.rpush.mockResolvedValue(1);

      await noTtlCache.listPush('my-list', { event: 'test' });

      expect(mockClient.rpush).toHaveBeenCalled();
      expect(mockClient.expire).not.toHaveBeenCalled();
    });
  });

  describe('listFromTo', () => {
    it('should get range from list', async () => {
      const events = [{ id: '1' }, { id: '2' }, { id: '3' }];
      mockClient.lrange.mockResolvedValue(events);

      const result = await cache.listFromTo('my-list', 0, 2);

      expect(mockClient.lrange).toHaveBeenCalledWith('mastra:cache:my-list', 0, 2);
      expect(result).toEqual(events);
    });

    it('should use -1 as default end index', async () => {
      mockClient.lrange.mockResolvedValue([]);

      await cache.listFromTo('my-list', 0);

      expect(mockClient.lrange).toHaveBeenCalledWith('mastra:cache:my-list', 0, -1);
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
      mockClient.scan
        .mockResolvedValueOnce([5, ['mastra:cache:key1']])
        .mockResolvedValueOnce([0, []]);
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

      // Upstash uses { ex: seconds } style
      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', 'value', { ex: 300 });
    });

    it('should use upstash-style scan', async () => {
      const upstashCache = new RedisServerCache({ client: mockClient }, upstashPreset);
      mockClient.scan.mockResolvedValue(['0', []]);

      await upstashCache.clear();

      // Upstash uses { match, count } style
      expect(mockClient.scan).toHaveBeenCalledWith('0', { match: 'mastra:cache:*', count: 100 });
    });
  });

  describe('nodeRedisPreset', () => {
    it('should use node-redis-style set with expiry', async () => {
      const nodeCache = new RedisServerCache({ client: mockClient }, nodeRedisPreset);
      mockClient.set.mockResolvedValue('OK');

      await nodeCache.set('test-key', 'value');

      // node-redis uses { EX: seconds } style
      expect(mockClient.set).toHaveBeenCalledWith('mastra:cache:test-key', 'value', { EX: 300 });
    });

    it('should use node-redis-style scan', async () => {
      const nodeCache = new RedisServerCache({ client: mockClient }, nodeRedisPreset);
      mockClient.scan.mockResolvedValue(['0', []]);

      await nodeCache.clear();

      // node-redis uses { MATCH, COUNT } style
      expect(mockClient.scan).toHaveBeenCalledWith('0', { MATCH: 'mastra:cache:*', COUNT: 100 });
    });
  });
});
