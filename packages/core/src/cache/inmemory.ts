import TTLCache from '@isaacs/ttlcache';
import { MastraServerCache } from './base';

export class InMemoryServerCache extends MastraServerCache {
  private cache: TTLCache<string, unknown> = new TTLCache({
    max: 1000,
    ttl: 1000 * 60 * 5,
  });

  constructor() {
    super({ name: 'InMemoryServerCache' });
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
