import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpstashServerCache } from './index';

// Mock the Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  llen: vi.fn(),
  rpush: vi.fn(),
  lrange: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  scan: vi.fn(),
};

describe('UpstashServerCache', () => {
  let cache: UpstashServerCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new UpstashServerCache({ client: mockRedis as any });
  });

  describe('inherits from RedisServerCache', () => {
    it('should be an instance of UpstashServerCache', () => {
      expect(cache).toBeInstanceOf(UpstashServerCache);
    });

    it('should have cache methods', async () => {
      mockRedis.get.mockResolvedValue({ foo: 'bar' });

      const result = await cache.get('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('mastra:cache:test-key');
      expect(result).toEqual({ foo: 'bar' });
    });
  });

  describe('uses upstash preset', () => {
    it('should use upstash-style set with expiry', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cache.set('test-key', 'value');

      // Upstash uses { ex: seconds } style, values are JSON-serialized
      expect(mockRedis.set).toHaveBeenCalledWith('mastra:cache:test-key', '"value"', { ex: 300 });
    });

    it('should use upstash-style scan', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await cache.clear();

      // Upstash uses { match, count } style
      expect(mockRedis.scan).toHaveBeenCalledWith('0', { match: 'mastra:cache:*', count: 100 });
    });
  });

  describe('options', () => {
    it('should use custom key prefix', async () => {
      const customCache = new UpstashServerCache({ client: mockRedis as any }, { keyPrefix: 'myapp:' });
      mockRedis.get.mockResolvedValue('value');

      await customCache.get('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('myapp:test-key');
    });

    it('should use custom TTL', async () => {
      const customCache = new UpstashServerCache({ client: mockRedis as any }, { ttlSeconds: 600 });
      mockRedis.set.mockResolvedValue('OK');

      await customCache.set('test-key', 'value');

      expect(mockRedis.set).toHaveBeenCalledWith('mastra:cache:test-key', '"value"', { ex: 600 });
    });

    it('should disable TTL when set to 0', async () => {
      const noTtlCache = new UpstashServerCache({ client: mockRedis as any }, { ttlSeconds: 0 });
      mockRedis.set.mockResolvedValue('OK');

      await noTtlCache.set('test-key', 'value');

      expect(mockRedis.set).toHaveBeenCalledWith('mastra:cache:test-key', '"value"');
    });
  });

  describe('list operations', () => {
    it('should push to list', async () => {
      mockRedis.rpush.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await cache.listPush('my-list', { event: 'test' });

      expect(mockRedis.rpush).toHaveBeenCalledWith('mastra:cache:my-list', '{"event":"test"}');
      expect(mockRedis.expire).toHaveBeenCalledWith('mastra:cache:my-list', 300);
    });

    it('should get list range', async () => {
      const events = [{ id: '1' }, { id: '2' }];
      mockRedis.lrange.mockResolvedValue(events);

      const result = await cache.listFromTo('my-list', 0, -1);

      expect(mockRedis.lrange).toHaveBeenCalledWith('mastra:cache:my-list', 0, -1);
      expect(result).toEqual(events);
    });

    it('should get list length', async () => {
      mockRedis.llen.mockResolvedValue(5);

      const result = await cache.listLength('my-list');

      expect(mockRedis.llen).toHaveBeenCalledWith('mastra:cache:my-list');
      expect(result).toBe(5);
    });
  });

  describe('delete and clear', () => {
    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await cache.delete('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('mastra:cache:test-key');
    });

    it('should clear all keys with prefix', async () => {
      mockRedis.scan.mockResolvedValueOnce(['5', ['mastra:cache:key1']]).mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(1);

      await cache.clear();

      expect(mockRedis.scan).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('mastra:cache:key1');
    });
  });
});
