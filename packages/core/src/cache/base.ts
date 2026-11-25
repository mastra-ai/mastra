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
   * Indices are opaque cursors — not list positions, and not dense. Within
   * one log's life they strictly increase and consecutive appends get
   * consecutive indices; readers resume from `index + 1`, not from a frame
   * count. A log recreated after its predecessor expired or was evicted
   * should avoid reissuing an index a subscriber may still hold — but no
   * implementation makes that absolute, so readers must not depend on it.
   *
   * How an implementation approaches it is up to it. The built-in Redis,
   * Valkey and in-memory caches seed a counter they create from the clock in
   * epoch MICROseconds — microseconds because a hot log appends faster than
   * the millisecond clock advances, and an index must not outrun the next
   * seed. Epoch microseconds stay well inside Number.MAX_SAFE_INTEGER (2^53
   * ≈ year 2255). `ConvexServerCache` instead allocates `max(counter, list
   * length)` inside one transaction, so its recreated logs renumber densely
   * from 0. A clock seed is only as monotonic as the clock: recreating a log
   * within the seed's resolution, or after the clock moves backwards, can
   * still repeat an index. The subscriber's fallback detection only
   * recognises a log that restarts at 0 (the dense case); a log reseeded
   * below a subscriber's cursor without reaching 0 goes unnoticed until that
   * reader reattaches.
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
   * The default implementation composes `increment()` + `listPush()` (multiple
   * round-trips) and ignores `ttlMs`. Replay reads depend on every index below
   * a published one already being in the log (the subscriber backfills gaps
   * from it), which an atomic allocate-and-append provides for free and
   * separate round-trips do not: a writer could publish its frame while an
   * earlier allocation's append is still in flight, and the gap backfill would
   * come up empty. So this fallback serializes appends per counter within the
   * process — sibling producers for one run share the process, so that covers
   * the writers that actually race. Appends from *other* processes can still
   * interleave with these; overrides should perform allocation, the seed check
   * and the append in one server-side operation instead (see the Redis and
   * Valkey caches).
   */
  async listPushIndexed(
    listKey: string,
    counterKey: string,
    value: Record<string, unknown>,
    _ttlMs?: number,
  ): Promise<number> {
    const prior = this.#indexedAppends.get(counterKey);
    const run = (prior ?? Promise.resolve()).then(async () => {
      let index = (await this.increment(counterKey)) - 1;
      if (index === 0) {
        // The counter was absent. Reseed so a log recreated after expiry is
        // unlikely to reissue indices a subscriber already consumed. Within
        // this process the serialization above makes the seed safe; a write
        // from another process can still land between the increment and this
        // set and lose its allocation.
        index = Date.now() * 1000;
        await this.set(counterKey, index + 1);
      }
      await this.listPush(listKey, { ...value, index });
      return index;
    });
    // Chain past failures so one failed append does not wedge the counter.
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    this.#indexedAppends.set(counterKey, settled);
    try {
      return await run;
    } finally {
      if (this.#indexedAppends.get(counterKey) === settled) this.#indexedAppends.delete(counterKey);
    }
  }

  /**
   * Per-counter chains serializing the composed fallback above. Entries are
   * removed as soon as their chain drains, so idle counters hold no memory.
   * Subclasses that override `listPushIndexed` never populate this.
   */
  #indexedAppends = new Map<string, Promise<void>>();
}
