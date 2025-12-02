// Type definitions for ttlcache 1.0.0
// Project: https://github.com/isaacs/ttlcache
// Loosely based on @isaacs/lru-cache
// https://github.com/isaacs/node-lru-cache/blob/v7.10.1/index.d.ts

declare class TTLCache<K, V> implements Iterable<[K, V]> {
  constructor(options?: TTLCache.Options<K, V>)

  ttl: number
  max: number
  updateAgeOnGet: boolean
  checkAgeOnGet: boolean
  noUpdateTTL: boolean
  noDisposeOnSet: boolean

  /**
   * The total number of items held in the cache at the current moment.
   */
  public readonly size: number

  /**
   * Add a value to the cache.
   */
  public set(key: K, value: V, options?: TTLCache.SetOptions): this

  /**
   * Return a value from the cache.
   * If the key is not found, `get()` will return `undefined`.
   * This can be confusing when setting values specifically to `undefined`,
   * as in `cache.set(key, undefined)`. Use `cache.has()` to determine
   * whether a key is present in the cache at all.
   */
  public get<T = V>(
    key: K,
    options?: TTLCache.GetOptions
  ): T | undefined

  /**
   * Check if a key is in the cache.
   * Will return false if the item is stale, even though it is technically
   * in the cache.
   */
  public has(key: K): boolean

  /**
   * Deletes a key out of the cache.
   * Returns true if the key was deleted, false otherwise.
   */
  public delete(key: K): boolean

  /**
   * Clear the cache entirely, throwing away all values.
   */
  public clear(): void

  /**
   * Delete any stale entries. Returns true if anything was removed, false
   * otherwise.
   */
  public purgeStale(): boolean

  /**
   * Return the remaining time before an item expires.
   * Returns 0 if the item is not found in the cache or is already expired.
   */
  public getRemainingTTL(key: K): number

  /**
   * Set the ttl explicitly to a value, defaulting to the TTL set on the ctor
   */
  public setTTL(key: K, ttl?: number): void

  /**
   * Return a generator yielding `[key, value]` pairs, from soonest expiring
   * to latest expiring. (Items expiring at the same time are walked in insertion order.)
   */
  public entries(): Generator<[K, V]>

  /**
   * Return a generator yielding the keys in the cache,
   * from soonest expiring to latest expiring.
   */
  public keys(): Generator<K>

  /**
   * Return a generator yielding the values in the cache,
   * from soonest expiring to latest expiring.
   */
  public values(): Generator<V>

  /**
   * Iterating over the cache itself yields the same results as
   * `cache.entries()`
   */
  public [Symbol.iterator](): Iterator<[K, V]>

  /**
   * Cancel the timer and stop automatically expiring entries.
   * This allows the process to gracefully exit where Timer.unref()
   * is not available.
   */
  public cancelTimer(): void
}

declare namespace TTLCache {
  type DisposeReason = 'evict' | 'set' | 'delete' | 'stale'

  type Disposer<K, V> = (
    value: V,
    key: K,
    reason: DisposeReason
  ) => void

  type TTLOptions = {
    /**
     * Max time in milliseconds for items to live in cache before they are
     * considered stale.  Note that stale items are NOT preemptively removed
     * by default, and MAY live in the cache, contributing to max,
     * long after they have expired.
     *
     * Must be an integer number of ms, or Infinity.  Defaults to `undefined`,
     * meaning that a TTL must be set explicitly for each set()
     */
    ttl?: number

    /**
     * Boolean flag to tell the cache to not update the TTL when
     * setting a new value for an existing key (ie, when updating a value
     * rather than inserting a new value).  Note that the TTL value is
     * _always_ set when adding a new entry into the cache.
     *
     * @default false
     */
    noUpdateTTL?: boolean
  }

  type Options<K, V> = {
    /**
     * The number of items to keep.
     *
     * @default Infinity
     */
    max?: number

    /**
     * Update the age of items on cache.get(), renewing their TTL
     *
     * @default false
     */
    updateAgeOnGet?: boolean

    /**
     * In the event that an item's expiration timer hasn't yet fired,
     * and an attempt is made to get() it, then return undefined and
     * delete it, rather than returning the cached value.
     *
     * By default, items are only expired when their timer fires, so there's
     * a bit of a "best effort" expiration, and the cache will return a value
     * if it has one, even if it's technically stale.
     *
     * @default false
     */
    checkAgeOnGet?: boolean

    /**
     * Do not call dispose() function when overwriting a key with a new value
     *
     * @default false
     */
    noDisposeOnSet?: boolean

    /**
     * Function that is called on items when they are dropped from the cache.
     * This can be handy if you want to close file descriptors or do other
     * cleanup tasks when items are no longer accessible. Called with `key,
     * value`.  It's called before actually removing the item from the
     * internal cache, so it is *NOT* safe to re-add them.
     * Use `disposeAfter` if you wish to dispose items after they have been
     * full removed, when it is safe to add them back to the cache.
     */
    dispose?: Disposer<K, V>
  } & TTLOptions

  type SetOptions = {
    /**
     * Do not call dispose() function when overwriting a key with a new value
     * Overrides the value set in the constructor.
     */
    noDisposeOnSet?: boolean

    /**
     * Do not update the TTL when overwriting an existing item.
     */
    noUpdateTTL?: boolean

    /**
     * Override the default TTL for this one set() operation.
     * Required if a TTL was not set in the constructor options.
     */
    ttl?: number
  }

  type GetOptions = {
    /**
     * Update the age of items on cache.get(), renewing their TTL
     *
     * @default false
     */
    updateAgeOnGet?: boolean

    /**
     * In the event that an item's expiration timer hasn't yet fired,
     * and an attempt is made to get() it, then return undefined and
     * delete it, rather than returning the cached value.
     *
     * By default, items are only expired when their timer fires, so there's
     * a bit of a "best effort" expiration, and the cache will return a value
     * if it has one, even if it's technically stale.
     *
     * @default false
     */
    checkAgeOnGet?: boolean

    /**
     * Set new TTL, applied only when `updateAgeOnGet` is true
     */
    ttl?: number
  }
}

export = TTLCache
