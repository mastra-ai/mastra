import { MastraServerCache } from '@mastra/core/cache';

/**
 * Minimal Redis client interface.
 *
 * This interface covers only the Redis operations needed by RedisServerCache.
 * Most Redis clients (ioredis, node-redis, @upstash/redis, etc.) naturally
 * conform to this interface.
 *
 * @example ioredis
 * ```typescript
 * import Redis from 'ioredis';
 * const client: RedisClient = new Redis();
 * ```
 *
 * @example node-redis
 * ```typescript
 * import { createClient } from 'redis';
 * const client = createClient();
 * await client.connect();
 * // node-redis client conforms to RedisClient interface
 * ```
 *
 * @example @upstash/redis
 * ```typescript
 * import { Redis } from '@upstash/redis';
 * const client: RedisClient = new Redis({ url: '...', token: '...' });
 * ```
 */
export interface RedisClient {
  /**
   * Get a value by key.
   * Redis command: GET
   */
  get(key: string): Promise<unknown>;

  /**
   * Set a value with optional expiry.
   * Redis command: SET / SETEX
   *
   * Note: Different clients have different signatures for expiry:
   * - ioredis: set(key, value, 'EX', seconds)
   * - node-redis: set(key, value, { EX: seconds })
   * - upstash: set(key, value, { ex: seconds })
   *
   * RedisServerCache handles this via the setWithExpiry option.
   */
  set(key: string, value: unknown, ...args: unknown[]): Promise<unknown>;

  /**
   * Get list length.
   * Redis command: LLEN
   */
  llen(key: string): Promise<number>;

  /**
   * Push value(s) to the end of a list.
   * Redis command: RPUSH
   */
  rpush(key: string, ...values: unknown[]): Promise<number>;

  /**
   * Get a range of elements from a list.
   * Redis command: LRANGE
   */
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;

  /**
   * Delete one or more keys.
   * Redis command: DEL
   */
  del(...keys: string[]): Promise<number>;

  /**
   * Set expiry on a key.
   * Redis command: EXPIRE
   */
  expire(key: string, seconds: number): Promise<number | boolean>;

  /**
   * Scan keys matching a pattern.
   * Redis command: SCAN
   *
   * Returns [cursor, keys] tuple.
   */
  scan(cursor: string | number, ...args: unknown[]): Promise<[string | number, string[]]>;

  /**
   * Atomically increment a key's integer value.
   * Redis command: INCR
   * Returns the new value after incrementing.
   * If the key doesn't exist, it's set to 0 before incrementing (returns 1).
   */
  incr(key: string): Promise<number>;
}

/**
 * Options for RedisServerCache
 */
export interface RedisServerCacheOptions {
  /**
   * Optional key prefix to namespace all cache keys.
   * Defaults to 'mastra:cache:'.
   */
  keyPrefix?: string;

  /**
   * Default TTL in seconds for cached items.
   * Defaults to 300 (5 minutes).
   * Set to 0 to disable TTL (items persist until explicitly deleted).
   */
  ttlSeconds?: number;

  /**
   * Custom function to set a value with expiry.
   * Different Redis clients have different APIs for this.
   *
   * Defaults to ioredis-style: client.set(key, value, 'EX', seconds)
   *
   * @example node-redis v4+
   * ```typescript
   * setWithExpiry: (client, key, value, seconds) =>
   *   client.set(key, value, { EX: seconds })
   * ```
   *
   * @example @upstash/redis
   * ```typescript
   * setWithExpiry: (client, key, value, seconds) =>
   *   client.set(key, value, { ex: seconds })
   * ```
   */
  setWithExpiry?: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<unknown>;

  /**
   * Custom function to call SCAN.
   * Different Redis clients have different APIs for SCAN options.
   *
   * Defaults to ioredis-style: client.scan(cursor, 'MATCH', pattern, 'COUNT', count)
   *
   * @example node-redis v4+
   * ```typescript
   * scanKeys: (client, cursor, pattern, count) =>
   *   client.scan(cursor, { MATCH: pattern, COUNT: count })
   * ```
   *
   * @example @upstash/redis
   * ```typescript
   * scanKeys: (client, cursor, pattern, count) =>
   *   client.scan(cursor, { match: pattern, count: count })
   * ```
   */
  scanKeys?: (
    client: RedisClient,
    cursor: string | number,
    pattern: string,
    count: number,
  ) => Promise<[string | number, string[]]>;
}

/**
 * Default setWithExpiry for ioredis-style clients.
 */
const defaultSetWithExpiry = (client: RedisClient, key: string, value: unknown, seconds: number): Promise<unknown> => {
  return client.set(key, value, 'EX', seconds);
};

/**
 * Default scanKeys for ioredis-style clients.
 */
const defaultScanKeys = (
  client: RedisClient,
  cursor: string | number,
  pattern: string,
  count: number,
): Promise<[string | number, string[]]> => {
  return client.scan(cursor, 'MATCH', pattern, 'COUNT', count);
};

/**
 * Generic Redis implementation of MastraServerCache.
 *
 * Works with any Redis-compatible client (ioredis, node-redis, @upstash/redis, etc.)
 * by accepting a client that implements the minimal RedisClient interface.
 *
 * @example With ioredis (default behavior)
 * ```typescript
 * import Redis from 'ioredis';
 * import { RedisServerCache } from '@mastra/redis';
 *
 * const client = new Redis();
 * const cache = new RedisServerCache({ client });
 * ```
 *
 * @example With node-redis
 * ```typescript
 * import { createClient } from 'redis';
 * import { RedisServerCache } from '@mastra/redis';
 *
 * const client = createClient();
 * await client.connect();
 *
 * const cache = new RedisServerCache({
 *   client,
 * }, {
 *   setWithExpiry: (c, key, value, seconds) =>
 *     c.set(key, value, { EX: seconds }),
 *   scanKeys: (c, cursor, pattern, count) =>
 *     c.scan(cursor, { MATCH: pattern, COUNT: count }),
 * });
 * ```
 *
 * @example With @upstash/redis
 * ```typescript
 * import { Redis } from '@upstash/redis';
 * import { RedisServerCache } from '@mastra/redis';
 *
 * const client = new Redis({ url: '...', token: '...' });
 *
 * const cache = new RedisServerCache({
 *   client,
 * }, {
 *   setWithExpiry: (c, key, value, seconds) =>
 *     c.set(key, value, { ex: seconds }),
 *   scanKeys: (c, cursor, pattern, count) =>
 *     c.scan(cursor, { match: pattern, count }),
 * });
 * ```
 *
 * @example With durable agent
 * ```typescript
 * import { createDurableAgent } from '@mastra/core/agent/durable';
 * import { RedisServerCache } from '@mastra/redis';
 * import Redis from 'ioredis';
 *
 * const cache = new RedisServerCache({
 *   client: new Redis(process.env.REDIS_URL),
 * });
 *
 * const durableAgent = createDurableAgent({
 *   agent,
 *   cache,
 * });
 * ```
 */
export class RedisServerCache extends MastraServerCache {
  private client: RedisClient;
  private keyPrefix: string;
  private ttlSeconds: number;
  private setWithExpiry: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<unknown>;
  private scanKeys: (
    client: RedisClient,
    cursor: string | number,
    pattern: string,
    count: number,
  ) => Promise<[string | number, string[]]>;

  constructor(config: { client: RedisClient }, options: RedisServerCacheOptions = {}) {
    super({ name: 'RedisServerCache' });

    this.client = config.client;
    this.keyPrefix = options.keyPrefix ?? 'mastra:cache:';
    this.ttlSeconds = options.ttlSeconds ?? 300;
    this.setWithExpiry = options.setWithExpiry ?? defaultSetWithExpiry;
    this.scanKeys = options.scanKeys ?? defaultScanKeys;
  }

  /**
   * Get the full key with prefix
   */
  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Serialize a value to JSON string for Redis storage
   */
  private serialize(value: unknown): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize a JSON string from Redis
   */
  private deserialize(value: unknown): unknown {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value; // Return as-is if not valid JSON
      }
    }
    return value;
  }

  /**
   * Get a value from the cache
   */
  async get(key: string): Promise<unknown> {
    const fullKey = this.getKey(key);
    const value = await this.client.get(fullKey);
    if (value === null) {
      return null;
    }
    return this.deserialize(value);
  }

  /**
   * Set a value in the cache
   */
  async set(key: string, value: unknown): Promise<void> {
    const fullKey = this.getKey(key);
    const serialized = this.serialize(value);
    if (this.ttlSeconds > 0) {
      await this.setWithExpiry(this.client, fullKey, serialized, this.ttlSeconds);
    } else {
      await this.client.set(fullKey, serialized);
    }
  }

  /**
   * Get the length of a list
   */
  async listLength(key: string): Promise<number> {
    const fullKey = this.getKey(key);
    return this.client.llen(fullKey);
  }

  /**
   * Push a value to the end of a list
   */
  async listPush(key: string, value: unknown): Promise<void> {
    const fullKey = this.getKey(key);
    const serialized = this.serialize(value);
    await this.client.rpush(fullKey, serialized);

    // Refresh TTL on push if TTL is enabled
    if (this.ttlSeconds > 0) {
      await this.client.expire(fullKey, this.ttlSeconds);
    }
  }

  /**
   * Get a range of values from a list.
   *
   * @param key - The list key
   * @param from - Start index (0-based, inclusive)
   * @param to - End index (0-based, inclusive). -1 means to the end.
   * @returns Array of values in the range
   */
  async listFromTo(key: string, from: number, to: number = -1): Promise<unknown[]> {
    const fullKey = this.getKey(key);
    const values = await this.client.lrange(fullKey, from, to);
    return values.map(v => this.deserialize(v));
  }

  /**
   * Delete a key from the cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    await this.client.del(fullKey);
  }

  /**
   * Clear all keys with this cache's prefix.
   * WARNING: This uses SCAN which can be slow on large datasets.
   */
  async clear(): Promise<void> {
    const pattern = `${this.keyPrefix}*`;
    let cursor: string | number = '0';

    do {
      const [nextCursor, keys] = await this.scanKeys(this.client, cursor, pattern, 100);

      if (keys.length > 0) {
        await this.client.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== '0' && cursor !== 0);
  }

  /**
   * Atomically increment a counter and return the new value.
   * Uses Redis INCR which is atomic - safe for concurrent access.
   * Returns 1 on first call (key initialized to 0, then incremented).
   */
  async increment(key: string): Promise<number> {
    const fullKey = this.getKey(key);
    return this.client.incr(fullKey);
  }
}

/**
 * Preset options for @upstash/redis clients.
 */
export const upstashPreset: Pick<RedisServerCacheOptions, 'setWithExpiry' | 'scanKeys'> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { ex: seconds } as any),
  scanKeys: (client, cursor, pattern, count) =>
    client.scan(cursor, { match: pattern, count } as any) as Promise<[string | number, string[]]>,
};

/**
 * Preset options for node-redis (redis npm package) v4+ clients.
 */
export const nodeRedisPreset: Pick<RedisServerCacheOptions, 'setWithExpiry' | 'scanKeys'> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { EX: seconds } as any),
  scanKeys: (client, cursor, pattern, count) =>
    client.scan(cursor, { MATCH: pattern, COUNT: count } as any) as Promise<[string | number, string[]]>,
};
