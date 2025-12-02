"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PooledNoRedirectClientSideCache = exports.BasicPooledClientSideCache = exports.PooledClientSideCacheProvider = exports.BasicClientSideCache = exports.ClientSideCacheProvider = exports.CacheStats = void 0;
const stream_1 = require("stream");
/**
 * A snapshot of cache statistics.
 *
 * This class provides an immutable view of the cache's operational statistics at a particular
 * point in time. It is heavily inspired by the statistics reporting capabilities found in
 * Ben Manes's Caffeine cache (https://github.com/ben-manes/caffeine).
 *
 * Instances of `CacheStats` are typically obtained from a {@link StatsCounter} and can be used
 * for performance monitoring, debugging, or logging. It includes metrics such as hit rate,
 * miss rate, load success/failure rates, average load penalty, and eviction counts.
 *
 * All statistics are non-negative. Rates and averages are typically in the range `[0.0, 1.0]`,
 * or `0` if the an operation has not occurred (e.g. hit rate is 0 if there are no requests).
 *
 * Cache statistics are incremented according to specific rules:
 * - When a cache lookup encounters an existing entry, hitCount is incremented.
 * - When a cache lookup encounters a missing entry, missCount is incremented.
 * - When a new entry is successfully loaded, loadSuccessCount is incremented and the
 *   loading time is added to totalLoadTime.
 * - When an entry fails to load, loadFailureCount is incremented and the
 *   loading time is added to totalLoadTime.
 * - When an entry is evicted due to size constraints or expiration,
 *   evictionCount is incremented.
 */
class CacheStats {
    hitCount;
    missCount;
    loadSuccessCount;
    loadFailureCount;
    totalLoadTime;
    evictionCount;
    /**
     * Creates a new CacheStats instance with the specified statistics.
     */
    constructor(hitCount, missCount, loadSuccessCount, loadFailureCount, totalLoadTime, evictionCount) {
        this.hitCount = hitCount;
        this.missCount = missCount;
        this.loadSuccessCount = loadSuccessCount;
        this.loadFailureCount = loadFailureCount;
        this.totalLoadTime = totalLoadTime;
        this.evictionCount = evictionCount;
        if (hitCount < 0 ||
            missCount < 0 ||
            loadSuccessCount < 0 ||
            loadFailureCount < 0 ||
            totalLoadTime < 0 ||
            evictionCount < 0) {
            throw new Error('All statistics values must be non-negative');
        }
    }
    /**
     * Creates a new CacheStats instance with the specified statistics.
     *
     * @param hitCount - Number of cache hits
     * @param missCount - Number of cache misses
     * @param loadSuccessCount - Number of successful cache loads
     * @param loadFailureCount - Number of failed cache loads
     * @param totalLoadTime - Total load time in milliseconds
     * @param evictionCount - Number of cache evictions
     */
    static of(hitCount = 0, missCount = 0, loadSuccessCount = 0, loadFailureCount = 0, totalLoadTime = 0, evictionCount = 0) {
        return new CacheStats(hitCount, missCount, loadSuccessCount, loadFailureCount, totalLoadTime, evictionCount);
    }
    /**
     * Returns a statistics instance where no cache events have been recorded.
     *
     * @returns An empty statistics instance
     */
    static empty() {
        return CacheStats.EMPTY_STATS;
    }
    /**
     * An empty stats instance with all counters set to zero.
     */
    static EMPTY_STATS = new CacheStats(0, 0, 0, 0, 0, 0);
    /**
    * Returns the total number of times cache lookup methods have returned
    * either a cached or uncached value.
    *
    * @returns Total number of requests (hits + misses)
    */
    requestCount() {
        return this.hitCount + this.missCount;
    }
    /**
     * Returns the hit rate of the cache.
     * This is defined as hitCount / requestCount, or 1.0 when requestCount is 0.
     *
     * @returns The ratio of cache requests that were hits (between 0.0 and 1.0)
     */
    hitRate() {
        const requestCount = this.requestCount();
        return requestCount === 0 ? 1.0 : this.hitCount / requestCount;
    }
    /**
     * Returns the miss rate of the cache.
     * This is defined as missCount / requestCount, or 0.0 when requestCount is 0.
     *
     * @returns The ratio of cache requests that were misses (between 0.0 and 1.0)
     */
    missRate() {
        const requestCount = this.requestCount();
        return requestCount === 0 ? 0.0 : this.missCount / requestCount;
    }
    /**
    * Returns the total number of load operations (successful + failed).
    *
    * @returns Total number of load operations
    */
    loadCount() {
        return this.loadSuccessCount + this.loadFailureCount;
    }
    /**
     * Returns the ratio of cache loading attempts that failed.
     * This is defined as loadFailureCount / loadCount, or 0.0 when loadCount is 0.
     *
     * @returns Ratio of load operations that failed (between 0.0 and 1.0)
     */
    loadFailureRate() {
        const loadCount = this.loadCount();
        return loadCount === 0 ? 0.0 : this.loadFailureCount / loadCount;
    }
    /**
     * Returns the average time spent loading new values, in milliseconds.
     * This is defined as totalLoadTime / loadCount, or 0.0 when loadCount is 0.
     *
     * @returns Average load time in milliseconds
     */
    averageLoadPenalty() {
        const loadCount = this.loadCount();
        return loadCount === 0 ? 0.0 : this.totalLoadTime / loadCount;
    }
    /**
    * Returns a new CacheStats representing the difference between this CacheStats
    * and another. Negative values are rounded up to zero.
    *
    * @param other - The statistics to subtract from this instance
    * @returns The difference between this instance and other
    */
    minus(other) {
        return CacheStats.of(Math.max(0, this.hitCount - other.hitCount), Math.max(0, this.missCount - other.missCount), Math.max(0, this.loadSuccessCount - other.loadSuccessCount), Math.max(0, this.loadFailureCount - other.loadFailureCount), Math.max(0, this.totalLoadTime - other.totalLoadTime), Math.max(0, this.evictionCount - other.evictionCount));
    }
    /**
     * Returns a new CacheStats representing the sum of this CacheStats and another.
     *
     * @param other - The statistics to add to this instance
     * @returns The sum of this instance and other
     */
    plus(other) {
        return CacheStats.of(this.hitCount + other.hitCount, this.missCount + other.missCount, this.loadSuccessCount + other.loadSuccessCount, this.loadFailureCount + other.loadFailureCount, this.totalLoadTime + other.totalLoadTime, this.evictionCount + other.evictionCount);
    }
}
exports.CacheStats = CacheStats;
/**
 * A StatsCounter implementation that does nothing and always returns empty stats.
 */
class DisabledStatsCounter {
    static INSTANCE = new DisabledStatsCounter();
    constructor() { }
    recordHits(count) { }
    recordMisses(count) { }
    recordLoadSuccess(loadTime) { }
    recordLoadFailure(loadTime) { }
    recordEvictions(count) { }
    snapshot() { return CacheStats.empty(); }
}
/**
 * Returns a StatsCounter that does not record any cache events.
 *
 * @return A StatsCounter that does not record metrics
 */
function disabledStatsCounter() {
    return DisabledStatsCounter.INSTANCE;
}
/**
 * A StatsCounter implementation that maintains cache statistics.
 */
class DefaultStatsCounter {
    #hitCount = 0;
    #missCount = 0;
    #loadSuccessCount = 0;
    #loadFailureCount = 0;
    #totalLoadTime = 0;
    #evictionCount = 0;
    /**
     * Records cache hits.
     *
     * @param count - The number of hits to record
     */
    recordHits(count) {
        this.#hitCount += count;
    }
    /**
     * Records cache misses.
     *
     * @param count - The number of misses to record
     */
    recordMisses(count) {
        this.#missCount += count;
    }
    /**
     * Records the successful load of a new entry.
     *
     * @param loadTime - The number of milliseconds spent loading the entry
     */
    recordLoadSuccess(loadTime) {
        this.#loadSuccessCount++;
        this.#totalLoadTime += loadTime;
    }
    /**
     * Records the failed load of a new entry.
     *
     * @param loadTime - The number of milliseconds spent attempting to load the entry
     */
    recordLoadFailure(loadTime) {
        this.#loadFailureCount++;
        this.#totalLoadTime += loadTime;
    }
    /**
     * Records cache evictions.
     *
     * @param count - The number of evictions to record
     */
    recordEvictions(count) {
        this.#evictionCount += count;
    }
    /**
     * Returns a snapshot of the current statistics.
     *
     * @returns A snapshot of the current statistics
     */
    snapshot() {
        return CacheStats.of(this.#hitCount, this.#missCount, this.#loadSuccessCount, this.#loadFailureCount, this.#totalLoadTime, this.#evictionCount);
    }
    /**
     * Creates a new DefaultStatsCounter.
     *
     * @returns A new DefaultStatsCounter instance
     */
    static create() {
        return new DefaultStatsCounter();
    }
}
/**
 * Generates a unique cache key from Redis command arguments
 *
 * @param redisArgs - Array of Redis command arguments
 * @returns A unique string key for caching
 */
function generateCacheKey(redisArgs) {
    const tmp = new Array(redisArgs.length * 2);
    for (let i = 0; i < redisArgs.length; i++) {
        tmp[i] = redisArgs[i].length;
        tmp[i + redisArgs.length] = redisArgs[i];
    }
    return tmp.join('_');
}
class ClientSideCacheEntryBase {
    #invalidated = false;
    #expireTime;
    constructor(ttl) {
        if (ttl == 0) {
            this.#expireTime = 0;
        }
        else {
            this.#expireTime = Date.now() + ttl;
        }
    }
    invalidate() {
        this.#invalidated = true;
    }
    validate() {
        return !this.#invalidated && (this.#expireTime == 0 || (Date.now() < this.#expireTime));
    }
}
class ClientSideCacheEntryValue extends ClientSideCacheEntryBase {
    #value;
    get value() {
        return this.#value;
    }
    constructor(ttl, value) {
        super(ttl);
        this.#value = value;
    }
}
class ClientSideCacheEntryPromise extends ClientSideCacheEntryBase {
    #sendCommandPromise;
    get promise() {
        return this.#sendCommandPromise;
    }
    constructor(ttl, sendCommandPromise) {
        super(ttl);
        this.#sendCommandPromise = sendCommandPromise;
    }
}
class ClientSideCacheProvider extends stream_1.EventEmitter {
}
exports.ClientSideCacheProvider = ClientSideCacheProvider;
class BasicClientSideCache extends ClientSideCacheProvider {
    #cacheKeyToEntryMap;
    #keyToCacheKeySetMap;
    ttl;
    maxEntries;
    lru;
    #statsCounter;
    recordEvictions(count) {
        this.#statsCounter.recordEvictions(count);
    }
    recordHits(count) {
        this.#statsCounter.recordHits(count);
    }
    recordMisses(count) {
        this.#statsCounter.recordMisses(count);
    }
    constructor(config) {
        super();
        this.#cacheKeyToEntryMap = new Map();
        this.#keyToCacheKeySetMap = new Map();
        this.ttl = config?.ttl ?? 0;
        this.maxEntries = config?.maxEntries ?? 0;
        this.lru = config?.evictPolicy !== "FIFO";
        const recordStats = config?.recordStats !== false;
        this.#statsCounter = recordStats ? DefaultStatsCounter.create() : disabledStatsCounter();
    }
    /* logic of how caching works:
  
    1. commands use a CommandParser
      it enables us to define/retrieve
        cacheKey - a unique key that corresponds to this command and its arguments
        redisKeys - an array of redis keys as strings that if the key is modified, will cause redis to invalidate this result when cached
    2. check if cacheKey is in our cache
      2b1. if its a value cacheEntry - return it
      2b2. if it's a promise cache entry - wait on promise and then go to 3c.
    3. if cacheEntry is not in cache
      3a. send the command save the promise into a a cacheEntry and then wait on result
      3b. transform reply (if required) based on transformReply
      3b. check the cacheEntry is still valid - in cache and hasn't been deleted)
      3c. if valid - overwrite with value entry
    4. return previously non cached result
    */
    async handleCache(client, parser, fn, transformReply, typeMapping) {
        let reply;
        const cacheKey = generateCacheKey(parser.redisArgs);
        // "2"
        let cacheEntry = this.get(cacheKey);
        if (cacheEntry) {
            // If instanceof is "too slow", can add a "type" and then use an "as" cast to call proper getters.
            if (cacheEntry instanceof ClientSideCacheEntryValue) { // "2b1"
                this.#statsCounter.recordHits(1);
                return structuredClone(cacheEntry.value);
            }
            else if (cacheEntry instanceof ClientSideCacheEntryPromise) { // 2b2
                // This counts as a miss since the value hasn't been fully loaded yet.
                this.#statsCounter.recordMisses(1);
                reply = await cacheEntry.promise;
            }
            else {
                throw new Error("unknown cache entry type");
            }
        }
        else { // 3/3a
            this.#statsCounter.recordMisses(1);
            const startTime = performance.now();
            const promise = fn();
            cacheEntry = this.createPromiseEntry(client, promise);
            this.set(cacheKey, cacheEntry, parser.keys);
            try {
                reply = await promise;
                const loadTime = performance.now() - startTime;
                this.#statsCounter.recordLoadSuccess(loadTime);
            }
            catch (err) {
                const loadTime = performance.now() - startTime;
                this.#statsCounter.recordLoadFailure(loadTime);
                if (cacheEntry.validate()) {
                    this.delete(cacheKey);
                }
                throw err;
            }
        }
        // 3b
        let val;
        if (transformReply) {
            val = transformReply(reply, parser.preserve, typeMapping);
        }
        else {
            val = reply;
        }
        // 3c
        if (cacheEntry.validate()) { // revalidating promise entry (dont save value, if promise entry has been invalidated)
            // 3d
            cacheEntry = this.createValueEntry(client, val);
            this.set(cacheKey, cacheEntry, parser.keys);
            this.emit("cached-key", cacheKey);
        }
        else {
            //   cache entry for key got invalidated between execution and saving, so not saving
        }
        return structuredClone(val);
    }
    trackingOn() {
        return ['CLIENT', 'TRACKING', 'ON'];
    }
    invalidate(key) {
        if (key === null) {
            this.clear(false);
            this.emit("invalidate", key);
            return;
        }
        const keySet = this.#keyToCacheKeySetMap.get(key.toString());
        if (keySet) {
            for (const cacheKey of keySet) {
                const entry = this.#cacheKeyToEntryMap.get(cacheKey);
                if (entry) {
                    entry.invalidate();
                }
                this.#cacheKeyToEntryMap.delete(cacheKey);
            }
            this.#keyToCacheKeySetMap.delete(key.toString());
        }
        this.emit('invalidate', key);
    }
    clear(resetStats = true) {
        const oldSize = this.#cacheKeyToEntryMap.size;
        this.#cacheKeyToEntryMap.clear();
        this.#keyToCacheKeySetMap.clear();
        if (resetStats) {
            if (!(this.#statsCounter instanceof DisabledStatsCounter)) {
                this.#statsCounter = DefaultStatsCounter.create();
            }
        }
        else {
            // If old entries were evicted due to clear, record them as evictions
            if (oldSize > 0) {
                this.#statsCounter.recordEvictions(oldSize);
            }
        }
    }
    get(cacheKey) {
        const val = this.#cacheKeyToEntryMap.get(cacheKey);
        if (val && !val.validate()) {
            this.delete(cacheKey);
            this.#statsCounter.recordEvictions(1);
            this.emit("cache-evict", cacheKey);
            return undefined;
        }
        if (val !== undefined && this.lru) {
            this.#cacheKeyToEntryMap.delete(cacheKey);
            this.#cacheKeyToEntryMap.set(cacheKey, val);
        }
        return val;
    }
    delete(cacheKey) {
        const entry = this.#cacheKeyToEntryMap.get(cacheKey);
        if (entry) {
            entry.invalidate();
            this.#cacheKeyToEntryMap.delete(cacheKey);
        }
    }
    has(cacheKey) {
        return this.#cacheKeyToEntryMap.has(cacheKey);
    }
    set(cacheKey, cacheEntry, keys) {
        let count = this.#cacheKeyToEntryMap.size;
        const oldEntry = this.#cacheKeyToEntryMap.get(cacheKey);
        if (oldEntry) {
            count--; // overwriting, so not incrementig
            oldEntry.invalidate();
        }
        if (this.maxEntries > 0 && count >= this.maxEntries) {
            this.deleteOldest();
            this.#statsCounter.recordEvictions(1);
        }
        this.#cacheKeyToEntryMap.set(cacheKey, cacheEntry);
        for (const key of keys) {
            if (!this.#keyToCacheKeySetMap.has(key.toString())) {
                this.#keyToCacheKeySetMap.set(key.toString(), new Set());
            }
            const cacheKeySet = this.#keyToCacheKeySetMap.get(key.toString());
            cacheKeySet.add(cacheKey);
        }
    }
    size() {
        return this.#cacheKeyToEntryMap.size;
    }
    createValueEntry(client, value) {
        return new ClientSideCacheEntryValue(this.ttl, value);
    }
    createPromiseEntry(client, sendCommandPromise) {
        return new ClientSideCacheEntryPromise(this.ttl, sendCommandPromise);
    }
    stats() {
        return this.#statsCounter.snapshot();
    }
    onError() {
        this.clear();
    }
    onClose() {
        this.clear();
    }
    /**
     * @internal
     */
    deleteOldest() {
        const it = this.#cacheKeyToEntryMap[Symbol.iterator]();
        const n = it.next();
        if (!n.done) {
            const key = n.value[0];
            const entry = this.#cacheKeyToEntryMap.get(key);
            if (entry) {
                entry.invalidate();
            }
            this.#cacheKeyToEntryMap.delete(key);
        }
    }
    /**
     * Get cache entries for debugging
     * @internal
     */
    entryEntries() {
        return this.#cacheKeyToEntryMap.entries();
    }
    /**
     * Get key set entries for debugging
     * @internal
     */
    keySetEntries() {
        return this.#keyToCacheKeySetMap.entries();
    }
}
exports.BasicClientSideCache = BasicClientSideCache;
class PooledClientSideCacheProvider extends BasicClientSideCache {
    #disabled = false;
    disable() {
        this.#disabled = true;
    }
    enable() {
        this.#disabled = false;
    }
    get(cacheKey) {
        if (this.#disabled) {
            return undefined;
        }
        return super.get(cacheKey);
    }
    has(cacheKey) {
        if (this.#disabled) {
            return false;
        }
        return super.has(cacheKey);
    }
    onPoolClose() {
        this.clear();
    }
}
exports.PooledClientSideCacheProvider = PooledClientSideCacheProvider;
class BasicPooledClientSideCache extends PooledClientSideCacheProvider {
    onError() {
        this.clear(false);
    }
    onClose() {
        this.clear(false);
    }
}
exports.BasicPooledClientSideCache = BasicPooledClientSideCache;
class PooledClientSideCacheEntryValue extends ClientSideCacheEntryValue {
    #creator;
    constructor(ttl, creator, value) {
        super(ttl, value);
        this.#creator = creator;
    }
    validate() {
        let ret = super.validate();
        if (this.#creator) {
            ret = ret && this.#creator.client.isReady && this.#creator.client.socketEpoch == this.#creator.epoch;
        }
        return ret;
    }
}
class PooledClientSideCacheEntryPromise extends ClientSideCacheEntryPromise {
    #creator;
    constructor(ttl, creator, sendCommandPromise) {
        super(ttl, sendCommandPromise);
        this.#creator = creator;
    }
    validate() {
        let ret = super.validate();
        return ret && this.#creator.client.isReady && this.#creator.client.socketEpoch == this.#creator.epoch;
    }
}
class PooledNoRedirectClientSideCache extends BasicPooledClientSideCache {
    createValueEntry(client, value) {
        const creator = {
            epoch: client.socketEpoch,
            client: client
        };
        return new PooledClientSideCacheEntryValue(this.ttl, creator, value);
    }
    createPromiseEntry(client, sendCommandPromise) {
        const creator = {
            epoch: client.socketEpoch,
            client: client
        };
        return new PooledClientSideCacheEntryPromise(this.ttl, creator, sendCommandPromise);
    }
    onError() { }
    onClose() { }
}
exports.PooledNoRedirectClientSideCache = PooledNoRedirectClientSideCache;
//# sourceMappingURL=cache.js.map