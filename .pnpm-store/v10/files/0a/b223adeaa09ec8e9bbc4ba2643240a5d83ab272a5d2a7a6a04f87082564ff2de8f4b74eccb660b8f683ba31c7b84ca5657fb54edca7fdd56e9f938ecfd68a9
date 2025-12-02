// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License

/** A simple Least Recently Used map */
export class ReduceableCache<K, V> {
  private readonly _cache: Map<K, V>

  public constructor(private readonly _maxSize: number) {
    this._cache = new Map<K, V>()
  }

  /** Get an entry or undefined if it was not in the cache. Re-inserts to update the recently used order */
  public get(key: K): V | undefined {
    const value = this._cache.get(key)
    if (value === undefined) {
      return undefined
    }
    // Remove and re-insert to update the order
    this._cache.delete(key)
    this._cache.set(key, value)
    return value
  }

  /** Insert an entry and evict an older entry if we've reached maxSize */
  public set(key: K, value: V): void {
    this._cache.set(key, value)
  }

  /** Remove an entry and return the entry if it was in the cache */
  public reduce(): void {
    while (this._cache.size >= this._maxSize) {
      const value = this._cache.keys().next().value
      if (value) {
        // keys() returns an iterator in insertion order so keys().next() gives us the oldest key
        this._cache.delete(value)
      }
    }
  }
}
