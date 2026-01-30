import { TTLCache } from '@isaacs/ttlcache';
import { MastraServerCache } from './base';

/**
 * Options for InMemoryServerCache
 */
export interface InMemoryServerCacheOptions {
  /**
   * Maximum number of items to store in cache.
   * Defaults to 1000.
   */
  maxSize?: number;

  /**
   * Default TTL in milliseconds for cached items.
   * Defaults to 300000 (5 minutes).
   * Set to 0 to disable TTL (items persist until explicitly deleted or evicted).
   */
  ttlMs?: number;
}

export class InMemoryServerCache extends MastraServerCache {
  private cache: TTLCache<string, unknown>;
  private ttlMs: number;

  constructor(options: InMemoryServerCacheOptions = {}) {
    super({ name: 'InMemoryServerCache' });

    this.ttlMs = options.ttlMs ?? 1000 * 60 * 5;
    // TTLCache requires positive integer or Infinity; use Infinity when TTL is disabled
    const ttl = this.ttlMs > 0 ? this.ttlMs : Infinity;

    this.cache = new TTLCache<string, unknown>({
      max: options.maxSize ?? 1000,
      ttl,
    });
  }

  async get(key: string): Promise<unknown> {
    return this.cache.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.cache.set(key, value);
  }

  async listLength(key: string): Promise<number> {
    const list = this.cache.get(key) as unknown[];
    if (!Array.isArray(list)) {
      throw new Error(`${key} is not an array`);
    }
    return list.length;
  }

  async listPush(key: string, value: unknown): Promise<void> {
    const list = this.cache.get(key) as unknown[];
    if (Array.isArray(list)) {
      list.push(value);
      // Refresh TTL on push by re-setting the key with the updated list
      if (this.ttlMs > 0) {
        this.cache.set(key, list, { ttl: this.ttlMs });
      }
    } else {
      this.cache.set(key, [value]);
    }
  }

  async listFromTo(key: string, from: number, to: number = -1): Promise<unknown[]> {
    const list = this.cache.get(key) as unknown[];
    if (Array.isArray(list)) {
      // Make 'to' inclusive like Redis LRANGE - add 1 unless it's -1
      const endIndex = to === -1 ? undefined : to + 1;
      return list.slice(from, endIndex);
    }
    return [];
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}
