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
   * Atomically allocate the next index from `counterKey` and append `value`
   * (with `index` set to the allocated index) to the list at `listKey`.
   * Returns the assigned index.
   *
   * Indices are opaque cursors — not list positions, and not dense. The
   * contract callers rely on is that within one log's life indices strictly
   * increase, consecutive appends get consecutive indices, and a log recreated
   * after its predecessor expired or was evicted does not reissue an index a
   * subscriber may still hold. Readers resume from `index + 1`, not
   * from a frame count.
   *
   * How an implementation keeps that last part is up to it. The built-in
   * Redis, Valkey and in-memory caches seed a counter they create from the
   * clock in epoch MICROseconds — microseconds because a hot log appends
   * faster than the millisecond clock advances, and an index must not outrun
   * the next seed. Epoch microseconds stay well inside
   * Number.MAX_SAFE_INTEGER (2^53 ≈ year 2255). `ConvexServerCache` instead
   * allocates `max(counter, list length)` inside one transaction. Neither is
   * absolute: a clock seed is only as monotonic as the clock, so recreating a
   * log within the seed's resolution, or after the clock moves backwards, can
   * still repeat an index. Readers detect a restarted log and resynchronise
   * rather than depend on that never happening.
   *
   * The list and its counter must expire together: a counter that expires
   * before its list would reuse indices already in the list. Every append
   * refreshes both keys to the same deadline.
   *
   * @param ttlMs - Minimum lifetime for both keys, in milliseconds. A cache
   *   whose own TTL is longer keeps that instead. An explicit `ttlMs` applies
   *   even when the cache's default expiry is disabled: the caller is stating
   *   a retention bound for this log, and a log that never expires is never
   *   reclaimed. When omitted, the cache's default TTL applies.
   *
   * The default implementation composes `increment()` + `listPush()` (two
   * round-trips) and is therefore NOT atomic, and ignores `ttlMs`. It is a
   * compatibility path, not a supported basis for resumable replay: concurrent
   * appends can interleave, an append can fail after its index is allocated,
   * and the seed can race. Overrides should perform allocation, the seed check
   * and the append in one server-side operation.
   */
  async listPushIndexed(
    listKey: string,
    counterKey: string,
    value: Record<string, unknown>,
    _ttlMs?: number,
  ): Promise<number> {
    let index = (await this.increment(counterKey)) - 1;
    if (index === 0) {
      // The counter was absent. Reseed so a log recreated after expiry is
      // unlikely to reissue indices a subscriber already consumed. Not atomic,
      // like the rest of this fallback: a concurrent append between the
      // increment and this set loses its allocation. `MastraServerCache`
      // subclasses that care about replay seed inside one server-side
      // operation instead (see the Redis and Valkey caches).
      index = Date.now() * 1000;
      await this.set(counterKey, index + 1);
    }
    await this.listPush(listKey, { ...value, index });
    return index;
  }
}
