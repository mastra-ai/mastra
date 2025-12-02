/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { RedisArgument, RedisFunctions, RedisModules, RedisScripts, RespVersions, TypeMapping } from '../RESP/types';
import { RedisClientType, RedisClientOptions, RedisClientExtensions } from '.';
import { EventEmitter } from 'node:events';
import { CommandOptions } from './commands-queue';
import { RedisClientMultiCommandType } from './multi-command';
import { ClientSideCacheConfig, PooledClientSideCacheProvider } from './cache';
import { MULTI_MODE, MultiMode } from '../multi-command';
export interface RedisPoolOptions {
    /**
     * The minimum number of clients to keep in the pool (>= 1).
     */
    minimum: number;
    /**
     * The maximum number of clients to keep in the pool (>= {@link RedisPoolOptions.minimum} >= 1).
     */
    maximum: number;
    /**
     * The maximum time a task can wait for a client to become available (>= 0).
     */
    acquireTimeout: number;
    /**
     * The delay in milliseconds before a cleanup operation is performed on idle clients.
     *
     * After this delay, the pool will check if there are too many idle clients and destroy
     * excess ones to maintain optimal pool size.
     */
    cleanupDelay: number;
    /**
     * Client Side Caching configuration for the pool.
     *
     * Enables Redis Servers and Clients to work together to cache results from commands
     * sent to a server. The server will notify the client when cached results are no longer valid.
     * In pooled mode, the cache is shared across all clients in the pool.
     *
     * Note: Client Side Caching is only supported with RESP3.
     *
     * @example Anonymous cache configuration
     * ```
     * const client = createClientPool({RESP: 3}, {
     *   clientSideCache: {
     *     ttl: 0,
     *     maxEntries: 0,
     *     evictPolicy: "LRU"
     *   },
     *   minimum: 5
     * });
     * ```
     *
     * @example Using a controllable cache
     * ```
     * const cache = new BasicPooledClientSideCache({
     *   ttl: 0,
     *   maxEntries: 0,
     *   evictPolicy: "LRU"
     * });
     * const client = createClientPool({RESP: 3}, {
     *   clientSideCache: cache,
     *   minimum: 5
     * });
     * ```
     */
    clientSideCache?: PooledClientSideCacheProvider | ClientSideCacheConfig;
    /**
     * Enable experimental support for RESP3 module commands.
     *
     * When enabled, allows the use of module commands that have been adapted
     * for the RESP3 protocol. This is an unstable feature and may change in
     * future versions.
     *
     * @default false
     */
    unstableResp3Modules?: boolean;
}
export type PoolTask<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping, T = unknown> = (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>) => T;
export type RedisClientPoolType<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}> = (RedisClientPool<M, F, S, RESP, TYPE_MAPPING> & RedisClientExtensions<M, F, S, RESP, TYPE_MAPPING>);
export declare class RedisClientPool<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}> extends EventEmitter {
    #private;
    static create<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping = {}>(clientOptions?: Omit<RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>, "clientSideCache">, options?: Partial<RedisPoolOptions>): RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING>;
    /**
     * The number of idle clients.
     */
    get idleClients(): number;
    /**
     * The number of clients in use.
     */
    get clientsInUse(): number;
    /**
     * The total number of clients in the pool (including connecting, idle, and in use).
     */
    get totalClients(): number;
    /**
     * The number of tasks waiting for a client to become available.
     */
    get tasksQueueLength(): number;
    /**
     * Whether the pool is open (either connecting or connected).
     */
    get isOpen(): boolean;
    /**
     * Whether the pool is closing (*not* closed).
     */
    get isClosing(): boolean;
    get clientSideCache(): PooledClientSideCacheProvider | undefined;
    /**
     * You are probably looking for {@link RedisClient.createPool `RedisClient.createPool`},
     * {@link RedisClientPool.fromClient `RedisClientPool.fromClient`},
     * or {@link RedisClientPool.fromOptions `RedisClientPool.fromOptions`}...
     */
    constructor(clientOptions?: RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>, options?: Partial<RedisPoolOptions>);
    private _self;
    private _commandOptions?;
    withCommandOptions<OPTIONS extends CommandOptions<TYPE_MAPPING>, TYPE_MAPPING extends TypeMapping>(options: OPTIONS): RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping<TYPE_MAPPING extends TypeMapping>(typeMapping: TYPE_MAPPING): RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    /**
     * Override the `abortSignal` command option
     */
    withAbortSignal(abortSignal: AbortSignal): RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING>;
    /**
     * Override the `asap` command option to `true`
     * TODO: remove?
     */
    asap(): RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING>;
    connect(): Promise<RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING> | undefined>;
    execute<T>(fn: PoolTask<M, F, S, RESP, TYPE_MAPPING, T>): Promise<Awaited<T>>;
    cleanupTimeout?: NodeJS.Timeout;
    sendCommand(args: Array<RedisArgument>, options?: CommandOptions): Promise<import("../RESP/types").ReplyUnion>;
    MULTI<isTyped extends MultiMode = MULTI_MODE['TYPED']>(): RedisClientMultiCommandType<isTyped, [], M, F, S, RESP, TYPE_MAPPING>;
    multi: <isTyped extends MultiMode = "typed">() => RedisClientMultiCommandType<isTyped, [], M, F, S, RESP, TYPE_MAPPING>;
    close(): Promise<void>;
    destroy(): void;
}
//# sourceMappingURL=pool.d.ts.map