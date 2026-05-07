import type { MastraServerCache } from './base';

/**
 * Lightweight cache interface consumed by the {@link ResponseCache} input
 * processor and other higher-level features that only need a typed get/set
 * with optional TTL.
 *
 * Wire a `MastraServerCache` (e.g. the in-memory default or
 * `@mastra/redis`) using {@link createMastraCacheFromServerCache}, or
 * implement the interface directly for custom backends.
 *
 * @example
 * ```typescript
 * const customCache: MastraCache = {
 *   async get(key) { return store.get(key); },
 *   async set(key, value, ttlSeconds) {
 *     store.set(key, value, ttlSeconds);
 *   },
 * };
 *
 * const agent = new Agent({
 *   ...,
 *   inputProcessors: [
 *     new ResponseCache({ cache: customCache, ttl: 600 }),
 *   ],
 * });
 * ```
 */
export interface MastraCache {
  /**
   * Retrieve a cached value by key.
   * @returns The cached value, or `undefined` if not found or expired.
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Store a value in the cache.
   * @param key - Cache key
   * @param value - Value to cache (must be JSON-serializable)
   * @param ttlSeconds - Optional TTL override in seconds. If omitted, the
   *   underlying implementation's default TTL is used.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

/**
 * Adapt a `MastraServerCache` instance to the lightweight `MastraCache`
 * interface. The returned cache forwards `get`/`set` calls and converts the
 * `ttlSeconds` argument from `MastraCache` into the milliseconds expected by
 * `MastraServerCache.set()`.
 */
export function createMastraCacheFromServerCache(serverCache: MastraServerCache): MastraCache {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const value = await serverCache.get(key);
      return (value === null ? undefined : value) as T | undefined;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      await serverCache.set(key, value, ttlSeconds !== undefined ? ttlSeconds * 1000 : undefined);
    },
  };
}
