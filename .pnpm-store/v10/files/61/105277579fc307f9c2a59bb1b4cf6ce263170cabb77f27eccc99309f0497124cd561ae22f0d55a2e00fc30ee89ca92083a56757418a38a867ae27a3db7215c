/// <reference types="node" />
/// <reference types="node" />
import { EventEmitter } from 'stream';
import RedisClient from '.';
import { RedisArgument, ReplyUnion, TransformReply, TypeMapping } from '../RESP/types';
import { BasicCommandParser } from './parser';
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
export declare class CacheStats {
    readonly hitCount: number;
    readonly missCount: number;
    readonly loadSuccessCount: number;
    readonly loadFailureCount: number;
    readonly totalLoadTime: number;
    readonly evictionCount: number;
    /**
     * Creates a new CacheStats instance with the specified statistics.
     */
    private constructor();
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
    static of(hitCount?: number, missCount?: number, loadSuccessCount?: number, loadFailureCount?: number, totalLoadTime?: number, evictionCount?: number): CacheStats;
    /**
     * Returns a statistics instance where no cache events have been recorded.
     *
     * @returns An empty statistics instance
     */
    static empty(): CacheStats;
    /**
     * An empty stats instance with all counters set to zero.
     */
    private static readonly EMPTY_STATS;
    /**
    * Returns the total number of times cache lookup methods have returned
    * either a cached or uncached value.
    *
    * @returns Total number of requests (hits + misses)
    */
    requestCount(): number;
    /**
     * Returns the hit rate of the cache.
     * This is defined as hitCount / requestCount, or 1.0 when requestCount is 0.
     *
     * @returns The ratio of cache requests that were hits (between 0.0 and 1.0)
     */
    hitRate(): number;
    /**
     * Returns the miss rate of the cache.
     * This is defined as missCount / requestCount, or 0.0 when requestCount is 0.
     *
     * @returns The ratio of cache requests that were misses (between 0.0 and 1.0)
     */
    missRate(): number;
    /**
    * Returns the total number of load operations (successful + failed).
    *
    * @returns Total number of load operations
    */
    loadCount(): number;
    /**
     * Returns the ratio of cache loading attempts that failed.
     * This is defined as loadFailureCount / loadCount, or 0.0 when loadCount is 0.
     *
     * @returns Ratio of load operations that failed (between 0.0 and 1.0)
     */
    loadFailureRate(): number;
    /**
     * Returns the average time spent loading new values, in milliseconds.
     * This is defined as totalLoadTime / loadCount, or 0.0 when loadCount is 0.
     *
     * @returns Average load time in milliseconds
     */
    averageLoadPenalty(): number;
    /**
    * Returns a new CacheStats representing the difference between this CacheStats
    * and another. Negative values are rounded up to zero.
    *
    * @param other - The statistics to subtract from this instance
    * @returns The difference between this instance and other
    */
    minus(other: CacheStats): CacheStats;
    /**
     * Returns a new CacheStats representing the sum of this CacheStats and another.
     *
     * @param other - The statistics to add to this instance
     * @returns The sum of this instance and other
     */
    plus(other: CacheStats): CacheStats;
}
/**
 * An accumulator for cache statistics.
 *
 * This interface defines the contract for objects that record cache-related events
 * such as hits, misses, loads (successes and failures), and evictions. The design
 * is inspired by the statistics collection mechanisms in Ben Manes's Caffeine cache
 * (https://github.com/ben-manes/caffeine).
 *
 * Implementations of this interface are responsible for aggregating these events.
 * A snapshot of the current statistics can be obtained by calling the `snapshot()`
 * method, which returns an immutable {@link CacheStats} object.
 *
 * Common implementations include `DefaultStatsCounter` for active statistics collection
 * and `DisabledStatsCounter` for a no-op version when stats are not needed.
 */
export interface StatsCounter {
    /**
     * Records cache hits. This should be called when a cache request returns a cached value.
     *
     * @param count - The number of hits to record
     */
    recordHits(count: number): void;
    /**
     * Records cache misses. This should be called when a cache request returns a value that was not
     * found in the cache.
     *
     * @param count - The number of misses to record
     */
    recordMisses(count: number): void;
    /**
     * Records the successful load of a new entry. This method should be called when a cache request
     * causes an entry to be loaded and the loading completes successfully.
     *
     * @param loadTime - The number of milliseconds the cache spent computing or retrieving the new value
     */
    recordLoadSuccess(loadTime: number): void;
    /**
     * Records the failed load of a new entry. This method should be called when a cache request
     * causes an entry to be loaded, but an exception is thrown while loading the entry.
     *
     * @param loadTime - The number of milliseconds the cache spent computing or retrieving the new value
     *                   prior to the failure
     */
    recordLoadFailure(loadTime: number): void;
    /**
     * Records the eviction of an entry from the cache. This should only be called when an entry is
     * evicted due to the cache's eviction strategy, and not as a result of manual invalidations.
     *
     * @param count - The number of evictions to record
     */
    recordEvictions(count: number): void;
    /**
     * Returns a snapshot of this counter's values. Note that this may be an inconsistent view, as it
     * may be interleaved with update operations.
     *
     * @return A snapshot of this counter's values
     */
    snapshot(): CacheStats;
}
type CachingClient = RedisClient<any, any, any, any, any>;
type CmdFunc = () => Promise<ReplyUnion>;
type EvictionPolicy = "LRU" | "FIFO";
/**
 * Configuration options for Client Side Cache
 */
export interface ClientSideCacheConfig {
    /**
     * Time-to-live in milliseconds for cached entries.
     * Use 0 for no expiration.
     * @default 0
     */
    ttl?: number;
    /**
     * Maximum number of entries to store in the cache.
     * Use 0 for unlimited entries.
     * @default 0
     */
    maxEntries?: number;
    /**
     * Eviction policy to use when the cache reaches its capacity.
     * - "LRU" (Least Recently Used): Evicts least recently accessed entries first
     * - "FIFO" (First In First Out): Evicts oldest entries first
     * @default "LRU"
     */
    evictPolicy?: EvictionPolicy;
    /**
     * Whether to collect statistics about cache operations.
     * @default true
     */
    recordStats?: boolean;
}
interface ClientSideCacheEntry {
    invalidate(): void;
    validate(): boolean;
}
declare abstract class ClientSideCacheEntryBase implements ClientSideCacheEntry {
    #private;
    constructor(ttl: number);
    invalidate(): void;
    validate(): boolean;
}
declare class ClientSideCacheEntryValue extends ClientSideCacheEntryBase {
    #private;
    get value(): any;
    constructor(ttl: number, value: any);
}
declare class ClientSideCacheEntryPromise extends ClientSideCacheEntryBase {
    #private;
    get promise(): Promise<ReplyUnion>;
    constructor(ttl: number, sendCommandPromise: Promise<ReplyUnion>);
}
export declare abstract class ClientSideCacheProvider extends EventEmitter {
    abstract handleCache(client: CachingClient, parser: BasicCommandParser, fn: CmdFunc, transformReply: TransformReply | undefined, typeMapping: TypeMapping | undefined): Promise<any>;
    abstract trackingOn(): Array<RedisArgument>;
    abstract invalidate(key: RedisArgument | null): void;
    abstract clear(): void;
    abstract stats(): CacheStats;
    abstract onError(): void;
    abstract onClose(): void;
}
export declare class BasicClientSideCache extends ClientSideCacheProvider {
    #private;
    readonly ttl: number;
    readonly maxEntries: number;
    readonly lru: boolean;
    recordEvictions(count: number): void;
    recordHits(count: number): void;
    recordMisses(count: number): void;
    constructor(config?: ClientSideCacheConfig);
    handleCache(client: CachingClient, parser: BasicCommandParser, fn: CmdFunc, transformReply?: TransformReply, typeMapping?: TypeMapping): Promise<any>;
    trackingOn(): string[];
    invalidate(key: RedisArgument | null): void;
    clear(resetStats?: boolean): void;
    get(cacheKey: string): ClientSideCacheEntry | undefined;
    delete(cacheKey: string): void;
    has(cacheKey: string): boolean;
    set(cacheKey: string, cacheEntry: ClientSideCacheEntry, keys: Array<RedisArgument>): void;
    size(): number;
    createValueEntry(client: CachingClient, value: any): ClientSideCacheEntryValue;
    createPromiseEntry(client: CachingClient, sendCommandPromise: Promise<ReplyUnion>): ClientSideCacheEntryPromise;
    stats(): CacheStats;
    onError(): void;
    onClose(): void;
    /**
     * @internal
     */
    deleteOldest(): void;
    /**
     * Get cache entries for debugging
     * @internal
     */
    entryEntries(): IterableIterator<[string, ClientSideCacheEntry]>;
    /**
     * Get key set entries for debugging
     * @internal
     */
    keySetEntries(): IterableIterator<[string, Set<string>]>;
}
export declare abstract class PooledClientSideCacheProvider extends BasicClientSideCache {
    #private;
    disable(): void;
    enable(): void;
    get(cacheKey: string): ClientSideCacheEntry | undefined;
    has(cacheKey: string): boolean;
    onPoolClose(): void;
}
export declare class BasicPooledClientSideCache extends PooledClientSideCacheProvider {
    onError(): void;
    onClose(): void;
}
export declare class PooledNoRedirectClientSideCache extends BasicPooledClientSideCache {
    createValueEntry(client: CachingClient, value: any): ClientSideCacheEntryValue;
    createPromiseEntry(client: CachingClient, sendCommandPromise: Promise<ReplyUnion>): ClientSideCacheEntryPromise;
    onError(): void;
    onClose(): void;
}
export {};
//# sourceMappingURL=cache.d.ts.map