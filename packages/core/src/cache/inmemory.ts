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
    const value = this.cache.get(key);
    if (value === undefined) {
      return 0; // Key doesn't exist - return 0
    }
    if (!Array.isArray(value)) {
      throw new Error(`${key} exists but is not an array`);
    }
    return value.length;
  }

  async listPush(key: string, value: unknown): Promise<void> {
    const existing = this.cache.get(key);
    if (Array.isArray(existing)) {
      existing.push(value);
      // Refresh TTL on push by re-setting the key with the updated list
      if (this.ttlMs > 0) {
        this.cache.set(key, existing, { ttl: this.ttlMs });
      }
    } else if (existing !== undefined) {
      throw new Error(`${key} exists but is not an array`);
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

  async increment(key: string): Promise<number> {
    const value = this.cache.get(key);
    let counter: number;
    if (value === undefined) {
      counter = 1;
    } else if (typeof value === 'number') {
      counter = value + 1;
    } else {
      throw new Error(`${key} exists but is not a number`);
    }
    this.cache.set(key, counter);
    return counter;
  }
}
