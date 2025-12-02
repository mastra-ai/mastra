/** A simple Least Recently Used map */
export declare class ReduceableCache<K, V> {
    private readonly _maxSize;
    private readonly _cache;
    constructor(_maxSize: number);
    /** Get an entry or undefined if it was not in the cache. Re-inserts to update the recently used order */
    get(key: K): V | undefined;
    /** Insert an entry and evict an older entry if we've reached maxSize */
    set(key: K, value: V): void;
    /** Remove an entry and return the entry if it was in the cache */
    reduce(): void;
}
//# sourceMappingURL=utils.d.ts.map