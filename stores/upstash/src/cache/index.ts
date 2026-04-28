import { RedisServerCache, upstashPreset } from '@mastra/redis';
import type { RedisClient, RedisServerCacheOptions } from '@mastra/redis';
import type { Redis } from '@upstash/redis';

/**
 * Configuration for UpstashServerCache.
 * Accepts either:
 * 1. An existing Redis client from @upstash/redis
 * 2. URL and token to create a client (requires @upstash/redis to be installed)
 */
export type UpstashCacheConfig = { client: Redis } | { url: string; token: string };

/**
 * Options for UpstashServerCache
 */
export interface UpstashServerCacheOptions {
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
}

/**
 * Upstash Redis implementation of MastraServerCache.
 *
 * This is a convenience wrapper around RedisServerCache from @mastra/redis
 * with the upstash preset pre-configured.
 *
 * @example With existing client
 * ```typescript
 * import { Redis } from '@upstash/redis';
 * import { UpstashServerCache } from '@mastra/upstash';
 *
 * const redis = new Redis({ url: '...', token: '...' });
 * const cache = new UpstashServerCache({ client: redis });
 * ```
 *
 * @example With URL and token
 * ```typescript
 * import { UpstashServerCache } from '@mastra/upstash';
 *
 * const cache = new UpstashServerCache({
 *   url: process.env.UPSTASH_REDIS_REST_URL!,
 *   token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 * });
 * ```
 */
export class UpstashServerCache extends RedisServerCache {
  constructor(config: UpstashCacheConfig, options: UpstashServerCacheOptions = {}) {
    let client: RedisClient;

    if ('client' in config) {
      client = config.client as unknown as RedisClient;
    } else {
      // Dynamically import @upstash/redis to create client
      // This allows the package to work without @upstash/redis if user passes their own client
      const { Redis } = require('@upstash/redis');
      client = new Redis({ url: config.url, token: config.token });
    }

    const redisOptions: RedisServerCacheOptions = {
      ...upstashPreset,
      keyPrefix: options.keyPrefix,
      ttlSeconds: options.ttlSeconds,
    };

    super({ client }, redisOptions);
  }
}

// Re-export the generic types for convenience
export { RedisServerCache, upstashPreset, type RedisClient, type RedisServerCacheOptions } from '@mastra/redis';
