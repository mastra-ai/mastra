import { MastraBase } from '../base';

export abstract class MastraServerCache extends MastraBase {
  constructor({ name }: { name: string }) {
    super({
      component: 'SERVER_CACHE',
      name,
    });
  }

  abstract get(key: string): Promise<unknown>;

  abstract listLength(key: string): Promise<number>;

  /**
   * Store a value in the cache.
   * @param key - Cache key
   * @param value - Value to store
   * @param ttlMs - Optional per-key TTL in milliseconds. If not provided, uses
   *   the implementation's default TTL.
   */
  abstract set(key: string, value: unknown, ttlMs?: number): Promise<void>;

  abstract listPush(key: string, value: unknown): Promise<void>;

  abstract listFromTo(key: string, from: number, to?: number): Promise<unknown[]>;

  abstract delete(key: string): Promise<void>;

  abstract clear(): Promise<void>;

  /**
   * Atomically increment a counter and return the new value.
   * Used for generating sequential indices for events.
   * Returns 1 on first call (counter starts at 0, increments to 1).
   *
   * For Redis: Uses INCR command which is atomic.
   * For in-memory: Uses a simple counter map.
   */
  abstract increment(key: string): Promise<number>;

  /**
   * Whether {@link listPushIndexed} allocates the index and appends the value
   * as one atomic operation, so list position and `index` agree even when
   * several processes append concurrently.
   *
   * Defaults to `false`. A cache that cannot append atomically cannot back a
   * numbered stream: two processes would interleave allocate and append,
   * handing two frames the same index or landing a lower index behind a higher
   * one. `CachingPubSub` publishes live-only through such a cache rather than
   * risk a subscriber dropping a frame as a duplicate.
   */
  get supportsAtomicAppend(): boolean {
    return false;
  }

  /**
   * Atomically allocate the next index from `counterKey` and append `value`
   * (with `index` set to the 0-based allocated index) to the list at `listKey`.
   * Returns the assigned index.
   *
   * The list and its counter must expire together: a counter that outlives its
   * list restarts at 0 while subscribers still expect the old numbering, and a
   * counter that expires first would start reusing indices already in the list.
   *
   * The default implementation composes `increment()` + `listPush()` (two
   * round-trips) and is therefore NOT atomic, which is why
   * {@link supportsAtomicAppend} defaults to `false`. Overrides should perform
   * both steps in one server-side operation.
   */
  async listPushIndexed(listKey: string, counterKey: string, value: Record<string, unknown>): Promise<number> {
    const index = (await this.increment(counterKey)) - 1;
    await this.listPush(listKey, { ...value, index });
    return index;
  }
}
