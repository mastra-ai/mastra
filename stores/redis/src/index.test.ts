import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisServerCache, upstashPreset, nodeRedisPreset } from './index';
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

// A client shape without classic EVAL, exercising the sequential fallback.
function createNoEvalMockClient(): RedisClient & { [key: string]: ReturnType<typeof vi.fn> } {
  const client = createMockClient();
  delete client.eval;
  return client;
}

// Simulates an ioredis-style classic client: the side-effect-free shape probe
// (the only script containing 'malformed') echoes 'match'; every other script
// resolves to `value`.
function mockClassicEval(client: any, value: unknown = 1) {
  client.eval.mockImplementation((script: string) => Promise.resolve(script.includes('malformed') ? 'match' : value));
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
    it('should push and refresh TTL in a single EVAL round trip', async () => {
      mockClassicEval(mockClient, 1);

      await cache.listPush('my-list', { event: 'test' });

      // One side-effect-free shape probe, then one EVAL for the push itself.
      expect(mockClient.eval).toHaveBeenCalledTimes(2);
      const [script, numKeys, key, value, seconds] = mockClient.eval.mock.calls.at(-1);
      expect(numKeys).toBe(1);
      expect(key).toBe('mastra:cache:my-list');
      expect(value).toBe('{"event":"test"}');
      expect(seconds).toBe('300');
      expect(script).toContain('RPUSH');
      expect(script).toContain('tonumber(ARGV[2]) > 0');
      expect(mockClient.rpush).not.toHaveBeenCalled();
      expect(mockClient.expire).not.toHaveBeenCalled();
    });

    it('should pass a zero seconds argument when ttlSeconds is 0', async () => {
      const noTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 0 });
      mockClassicEval(mockClient, 1);

      await noTtlCache.listPush('my-list', { event: 'test' });

      const [, , , , seconds] = mockClient.eval.mock.calls.at(-1);
      expect(seconds).toBe('0');
    });

    it('should reject undefined values instead of storing the string "undefined"', async () => {
      mockClient.eval.mockResolvedValue(1);

      await expect(cache.listPush('my-list', undefined)).rejects.toThrow(TypeError);
      expect(mockClient.eval).not.toHaveBeenCalled();
      expect(mockClient.rpush).not.toHaveBeenCalled();
    });

    it('should fall back to RPUSH + EXPIRE when the client has no EVAL', async () => {
      const noEvalClient = createNoEvalMockClient();
      const noEvalCache = new RedisServerCache({ client: noEvalClient });
      noEvalClient.rpush.mockResolvedValue(1);
      noEvalClient.expire.mockResolvedValue(1);

      await noEvalCache.listPush('my-list', { event: 'test' });

      expect(noEvalClient.eval).toBeUndefined();
      expect(noEvalClient.rpush).toHaveBeenCalledWith('mastra:cache:my-list', '{"event":"test"}');
      expect(noEvalClient.expire).toHaveBeenCalledWith('mastra:cache:my-list', 300);
    });

    it('should use the sequential path when pushToListWithExpiry is overridden (upstash)', async () => {
      const upstashCache = new RedisServerCache({ client: mockClient }, upstashPreset);
      mockClient.rpush.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(1);

      await upstashCache.listPush('my-list', { event: 'test' });

      expect(mockClient.eval).not.toHaveBeenCalled();
      expect(mockClient.rpush).toHaveBeenCalledWith('mastra:cache:my-list', '{"event":"test"}');
      expect(mockClient.expire).toHaveBeenCalledWith('mastra:cache:my-list', 300);
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
    it('should increment with prefixed key and refresh TTL in a single EVAL round trip', async () => {
      mockClassicEval(mockClient, 3);

      const result = await cache.increment('counter');

      // One side-effect-free shape probe, then one EVAL for the increment.
      expect(mockClient.eval).toHaveBeenCalledTimes(2);
      const [script, numKeys, key, seconds] = mockClient.eval.mock.calls.at(-1);
      expect(numKeys).toBe(1);
      expect(key).toBe('mastra:cache:counter');
      expect(seconds).toBe('300');
      expect(script).toContain('INCR');
      expect(script).toContain('tonumber(ARGV[1]) > 0');
      expect(script).toContain('return');
      expect(mockClient.incr).not.toHaveBeenCalled();
      expect(mockClient.expire).not.toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it('should probe the options-object EVAL shape on node-redis v5 clients and cache it', async () => {
      // @redis/client 5.12.1: a classic (script, numKeys, ...) call does NOT
      // fail at arity — it is serialized as `EVAL <script> 0` and executed
      // with empty KEYS/ARGV. The probe script detects this ('malformed')
      // without touching data; only the { keys, arguments } form round-trips.
      const v5Mock: any = createMockClient();
      v5Mock.eval.mockImplementation((script: string, second: unknown) => {
        const isProbe = script.includes('malformed');
        if (typeof second === 'number') {
          if (isProbe) {
            return Promise.resolve('malformed');
          }
          return Promise.reject(new Error('executed as EVAL <script> 0: INCR on empty KEYS'));
        }
        return Promise.resolve(isProbe ? 'match' : 3);
      });
      const v5Cache = new RedisServerCache({ client: v5Mock });

      const first = await v5Cache.increment('counter');
      expect(first).toBe(3);
      // classic probe (malformed) → options probe (match) → real call. The
      // mutative script itself never ran through the broken classic shape.
      expect(v5Mock.eval).toHaveBeenCalledTimes(3);
      const [, classicSecond] = v5Mock.eval.mock.calls[0];
      expect(classicSecond).toBe(1);

      const second = await v5Cache.increment('counter');
      expect(second).toBe(3);
      expect(v5Mock.eval).toHaveBeenCalledTimes(4); // cached shape, no re-probe
      const [script, options] = v5Mock.eval.mock.calls.at(-1);
      expect(script).toContain('INCR');
      expect(options).toEqual({ keys: ['mastra:cache:counter'], arguments: ['300'] });
    });

    it('should not retry an EVAL that may have executed (post-execution failure)', async () => {
      // The probe wins the classic shape; the real script then rejects after
      // execution (e.g. a script error or a dropped connection). The call
      // must NOT be retried in the other shape — the script may have mutated
      // data already.
      const flakyMock: any = createMockClient();
      flakyMock.eval.mockImplementation((script: string) => {
        if (script.includes('malformed')) {
          return Promise.resolve('match');
        }
        return Promise.reject(new Error('connection closed mid-execution'));
      });
      const flakyCache = new RedisServerCache({ client: flakyMock });

      await expect(flakyCache.increment('counter')).rejects.toThrow('connection closed mid-execution');
      // probe + exactly one real call; no second shape attempted
      expect(flakyMock.eval).toHaveBeenCalledTimes(2);
      const [, second] = flakyMock.eval.mock.calls[1];
      expect(second).toBe(1);
      expect(flakyMock.incr).not.toHaveBeenCalled();
    });

    it('should fall back to sequential commands when no EVAL shape round-trips the probe', async () => {
      // The client exposes EVAL but neither shape delivers KEYS/ARGV: the
      // probe result ('unsupported') is cached and increment takes the INCR +
      // EXPIRE path instead of failing.
      const brokenMock: any = createMockClient();
      brokenMock.eval.mockResolvedValue('garbage');
      brokenMock.incr.mockResolvedValue(4);
      brokenMock.expire.mockResolvedValue(1);
      const brokenCache = new RedisServerCache({ client: brokenMock });

      const result = await brokenCache.increment('counter');
      expect(result).toBe(4);
      expect(brokenMock.eval).toHaveBeenCalledTimes(2); // both shapes probed once
      expect(brokenMock.incr).toHaveBeenCalledWith('mastra:cache:counter');
      expect(brokenMock.expire).toHaveBeenCalledWith('mastra:cache:counter', 300);

      await brokenCache.increment('counter');
      expect(brokenMock.eval).toHaveBeenCalledTimes(2); // unsupported cached, no re-probe
      expect(brokenMock.incr).toHaveBeenCalledTimes(2);
    });

    it('should share one probe across concurrent first calls on the same client', async () => {
      mockClassicEval(mockClient, 1);

      await Promise.all([cache.increment('counter'), cache.increment('counter')]);

      // One shared probe + two real EVALs; without deduplication each caller
      // would run its own probe (4 eval calls).
      expect(mockClient.eval).toHaveBeenCalledTimes(3);
    });

    it('should coerce an EVAL result that comes back as a string', async () => {
      mockClassicEval(mockClient, '7');

      const result = await cache.increment('counter');

      expect(result).toBe(7);
    });

    it('should pass a zero seconds argument when ttlSeconds is 0', async () => {
      const noTtlCache = new RedisServerCache({ client: mockClient }, { ttlSeconds: 0 });
      mockClassicEval(mockClient, 1);

      const result = await noTtlCache.increment('counter');

      const [, , , seconds] = mockClient.eval.mock.calls.at(-1);
      expect(seconds).toBe('0');
      expect(result).toBe(1);
    });

    it('should fall back to INCR + EXPIRE when the client has no EVAL', async () => {
      const noEvalClient = createNoEvalMockClient();
      const noEvalCache = new RedisServerCache({ client: noEvalClient });
      noEvalClient.incr.mockResolvedValue(4);
      noEvalClient.expire.mockResolvedValue(1);

      const result = await noEvalCache.increment('counter');

      expect(noEvalClient.incr).toHaveBeenCalledWith('mastra:cache:counter');
      expect(noEvalClient.expire).toHaveBeenCalledWith('mastra:cache:counter', 300);
      expect(result).toBe(4);
    });

    it('should use the sequential path when incrementWithExpiry is overridden (upstash)', async () => {
      const upstashCache = new RedisServerCache({ client: mockClient }, upstashPreset);
      mockClient.incr.mockResolvedValue(5);
      mockClient.expire.mockResolvedValue(1);

      const result = await upstashCache.increment('counter');

      expect(mockClient.eval).not.toHaveBeenCalled();
      expect(mockClient.incr).toHaveBeenCalledWith('mastra:cache:counter');
      expect(mockClient.expire).toHaveBeenCalledWith('mastra:cache:counter', 300);
      expect(result).toBe(5);
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
      // Without EVAL the atomic push falls back to the preset's pushToList,
      // which is what routes through node-redis's camelCase rPush. With EVAL
      // present the Lua fast path replaces both commands entirely.
      const nodeMock: any = { ...createNoEvalMockClient(), rPush: vi.fn().mockResolvedValue(1) };
      const nodeCache = new RedisServerCache({ client: nodeMock }, nodeRedisPreset);

      await nodeCache.listPush('my-list', { event: 'test' });

      expect(nodeMock.rPush).toHaveBeenCalledWith('mastra:cache:my-list', '{"event":"test"}');
      expect(nodeMock.rpush).not.toHaveBeenCalled();
      expect(nodeMock.expire).toHaveBeenCalledWith('mastra:cache:my-list', 300);
    });

    it('uses the Lua fast path for list push when the client exposes EVAL', async () => {
      const nodeMock: any = { ...createMockClient(), rPush: vi.fn().mockResolvedValue(1) };
      const nodeCache = new RedisServerCache({ client: nodeMock }, nodeRedisPreset);
      mockClassicEval(nodeMock, 1);

      await nodeCache.listPush('my-list', { event: 'test' });

      // probe + one Lua push
      expect(nodeMock.eval).toHaveBeenCalledTimes(2);
      expect(nodeMock.rPush).not.toHaveBeenCalled();
      expect(nodeMock.expire).not.toHaveBeenCalled();
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
  });
});
