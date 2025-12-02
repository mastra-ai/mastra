/// <reference types="node" />
import { EventEmitter } from 'node:events';
import { CommandArguments, RedisFunctions, RedisModules, RedisScripts, ReplyUnion, RespVersions, TypeMapping } from '../RESP/types';
import RedisClient, { RedisClientType } from '../client';
import { CommandOptions } from '../client/commands-queue';
import { RedisNode, RedisSentinelClientType, RedisSentinelOptions, RedisSentinelType, SentinelCommander } from './types';
import { RedisMultiQueuedCommand } from '../multi-command';
import { RedisSentinelMultiCommandType } from './multi-commands';
import { PubSubListener } from '../client/pub-sub';
import { RedisVariadicArgument } from '../commands/generic-transformers';
import { PooledClientSideCacheProvider } from '../client/cache';
interface ClientInfo {
    id: number;
}
export declare class RedisSentinelClient<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> {
    #private;
    readonly _self: RedisSentinelClient<M, F, S, RESP, TYPE_MAPPING>;
    /**
     * Indicates if the client connection is open
     *
     * @returns `true` if the client connection is open, `false` otherwise
     */
    get isOpen(): boolean;
    /**
     * Indicates if the client connection is ready to accept commands
     *
     * @returns `true` if the client connection is ready, `false` otherwise
     */
    get isReady(): boolean;
    /**
     * Gets the command options configured for this client
     *
     * @returns The command options for this client or `undefined` if none were set
     */
    get commandOptions(): CommandOptions<TYPE_MAPPING> | undefined;
    constructor(internal: RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>, clientInfo: ClientInfo, commandOptions?: CommandOptions<TYPE_MAPPING>);
    static factory<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}>(config?: SentinelCommander<M, F, S, RESP, TYPE_MAPPING>): (internal: RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>, clientInfo: ClientInfo, commandOptions?: CommandOptions<TYPE_MAPPING>) => RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING>;
    static create<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}>(options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>, internal: RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>, clientInfo: ClientInfo, commandOptions?: CommandOptions<TYPE_MAPPING>): RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING>;
    withCommandOptions<OPTIONS extends CommandOptions<TYPE_MAPPING>, TYPE_MAPPING extends TypeMapping>(options: OPTIONS): RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    private _commandOptionsProxy;
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping<TYPE_MAPPING extends TypeMapping>(typeMapping: TYPE_MAPPING): RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    _execute<T>(isReadonly: boolean | undefined, fn: (client: RedisClient<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => Promise<T>): Promise<T>;
    sendCommand<T = ReplyUnion>(isReadonly: boolean | undefined, args: CommandArguments, options?: CommandOptions): Promise<T>;
    /**
     * @internal
     */
    _executePipeline(isReadonly: boolean | undefined, commands: Array<RedisMultiQueuedCommand>): Promise<unknown[]>;
    /**f
      * @internal
      */
    _executeMulti(isReadonly: boolean | undefined, commands: Array<RedisMultiQueuedCommand>): Promise<unknown[]>;
    MULTI(): RedisSentinelMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING>;
    multi: () => RedisSentinelMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING>;
    WATCH(key: RedisVariadicArgument): Promise<"OK">;
    watch: (key: RedisVariadicArgument) => Promise<"OK">;
    UNWATCH(): Promise<"OK">;
    unwatch: () => Promise<"OK">;
    /**
     * Releases the client lease back to the pool
     *
     * After calling this method, the client instance should no longer be used as it
     * will be returned to the client pool and may be given to other operations.
     *
     * @returns A promise that resolves when the client is ready to be reused, or undefined
     *          if the client was immediately ready
     * @throws Error if the lease has already been released
     */
    release(): Promise<void> | undefined;
}
export default class RedisSentinel<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> extends EventEmitter {
    #private;
    readonly _self: RedisSentinel<M, F, S, RESP, TYPE_MAPPING>;
    /**
     * Indicates if the sentinel connection is open
     *
     * @returns `true` if the sentinel connection is open, `false` otherwise
     */
    get isOpen(): boolean;
    /**
     * Indicates if the sentinel connection is ready to accept commands
     *
     * @returns `true` if the sentinel connection is ready, `false` otherwise
     */
    get isReady(): boolean;
    get commandOptions(): CommandOptions<TYPE_MAPPING> | undefined;
    get clientSideCache(): PooledClientSideCacheProvider | undefined;
    constructor(options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>);
    static factory<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}>(config?: SentinelCommander<M, F, S, RESP, TYPE_MAPPING>): (options: Omit<RedisSentinelOptions, keyof Exclude<typeof config, undefined>>) => RedisSentinelType<M, F, S, RESP, TYPE_MAPPING>;
    static create<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}>(options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>): RedisSentinelType<M, F, S, RESP, TYPE_MAPPING>;
    withCommandOptions<OPTIONS extends CommandOptions<TYPE_MAPPING>, TYPE_MAPPING extends TypeMapping>(options: OPTIONS): RedisSentinelType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    private _commandOptionsProxy;
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping<TYPE_MAPPING extends TypeMapping>(typeMapping: TYPE_MAPPING): RedisSentinelType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    connect(): Promise<RedisSentinelType<M, F, S, RESP, TYPE_MAPPING>>;
    _execute<T>(isReadonly: boolean | undefined, fn: (client: RedisClient<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => Promise<T>): Promise<T>;
    use<T>(fn: (sentinelClient: RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING>) => Promise<T>): Promise<T>;
    sendCommand<T = ReplyUnion>(isReadonly: boolean | undefined, args: CommandArguments, options?: CommandOptions): Promise<T>;
    /**
     * @internal
     */
    _executePipeline(isReadonly: boolean | undefined, commands: Array<RedisMultiQueuedCommand>): Promise<unknown[]>;
    /**f
      * @internal
      */
    _executeMulti(isReadonly: boolean | undefined, commands: Array<RedisMultiQueuedCommand>): Promise<unknown[]>;
    MULTI(): RedisSentinelMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING>;
    multi: () => RedisSentinelMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING>;
    close(): Promise<void>;
    destroy(): Promise<void>;
    SUBSCRIBE<T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void | undefined>;
    subscribe: <T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T | undefined) => Promise<void | undefined>;
    UNSUBSCRIBE<T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<boolean>, bufferMode?: T): Promise<void | undefined>;
    unsubscribe: <T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<boolean>, bufferMode?: T | undefined) => Promise<void | undefined>;
    PSUBSCRIBE<T extends boolean = false>(patterns: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void | undefined>;
    pSubscribe: <T extends boolean = false>(patterns: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T | undefined) => Promise<void | undefined>;
    PUNSUBSCRIBE<T extends boolean = false>(patterns?: string | Array<string>, listener?: PubSubListener<T>, bufferMode?: T): Promise<void | undefined>;
    pUnsubscribe: <T extends boolean = false>(patterns?: string | Array<string>, listener?: PubSubListener<T> | undefined, bufferMode?: T | undefined) => Promise<void | undefined>;
    /**
     * Acquires a master client lease for exclusive operations
     *
     * Used when multiple commands need to run on an exclusive client (for example, using `WATCH/MULTI/EXEC`).
     * The returned client must be released after use with the `release()` method.
     *
     * @returns A promise that resolves to a Redis client connected to the master node
     * @example
     * ```javascript
     * const clientLease = await sentinel.acquire();
     *
     * try {
     *   await clientLease.watch('key');
     *   const resp = await clientLease.multi()
     *     .get('key')
     *     .exec();
     * } finally {
     *   clientLease.release();
     * }
     * ```
     */
    acquire(): Promise<RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING>>;
    getSentinelNode(): RedisNode | undefined;
    getMasterNode(): RedisNode | undefined;
    getReplicaNodes(): Map<RedisNode, number>;
    setTracer(tracer?: Array<string>): void;
}
declare class RedisSentinelInternal<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> extends EventEmitter {
    #private;
    get isOpen(): boolean;
    get isReady(): boolean;
    get useReplicas(): boolean;
    get clientSideCache(): PooledClientSideCacheProvider | undefined;
    constructor(options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>);
    /**
     * Gets a client lease from the master client pool
     *
     * @returns A client info object or a promise that resolves to a client info object
     *          when a client becomes available
     */
    getClientLease(): ClientInfo | Promise<ClientInfo>;
    /**
     * Releases a client lease back to the pool
     *
     * If the client was used for a transaction that might have left it in a dirty state,
     * it will be reset before being returned to the pool.
     *
     * @param clientInfo The client info object representing the client to release
     * @returns A promise that resolves when the client is ready to be reused, or undefined
     *          if the client was immediately ready or no longer exists
     */
    releaseClientLease(clientInfo: ClientInfo): Promise<void> | undefined;
    connect(): Promise<void>;
    execute<T>(fn: (client: RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => Promise<T>, clientInfo?: ClientInfo): Promise<T>;
    close(): Promise<void>;
    destroy(): Promise<void>;
    subscribe<T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void | undefined>;
    unsubscribe<T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<boolean>, bufferMode?: T): Promise<void | undefined>;
    pSubscribe<T extends boolean = false>(patterns: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void | undefined>;
    pUnsubscribe<T extends boolean = false>(patterns?: string | Array<string>, listener?: PubSubListener<T>, bufferMode?: T): Promise<void | undefined>;
    observe(): Promise<{
        sentinelConnected: RedisNode;
        sentinelData: {
            [x: string]: string;
        }[];
        masterData: {
            [x: string]: string;
        };
        replicaData: {
            [x: string]: string;
        }[];
        currentMaster: RedisNode | undefined;
        currentReplicas: Map<RedisNode, number>;
        currentSentinel: RedisNode | undefined;
        replicaPoolSize: number;
        useReplicas: boolean;
    }>;
    analyze(observed: Awaited<ReturnType<RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>["observe"]>>): {
        sentinelList: RedisNode[];
        epoch: number;
        sentinelToOpen: RedisNode | undefined;
        masterToOpen: RedisNode | undefined;
        replicasToClose: RedisNode[];
        replicasToOpen: Map<RedisNode, number>;
    };
    transform(analyzed: ReturnType<RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>["analyze"]>): Promise<void>;
    getMasterNode(): RedisNode | undefined;
    getSentinelNode(): RedisNode | undefined;
    getReplicaNodes(): Map<RedisNode, number>;
    setTracer(tracer?: Array<string>): void;
}
export declare class RedisSentinelFactory extends EventEmitter {
    #private;
    options: RedisSentinelOptions;
    constructor(options: RedisSentinelOptions);
    updateSentinelRootNodes(): Promise<void>;
    getMasterNode(): Promise<RedisNode>;
    getMasterClient(): Promise<RedisClientType<RedisModules, RedisFunctions, RedisScripts, 2 | 3, TypeMapping>>;
    getReplicaNodes(): Promise<RedisNode[]>;
    getReplicaClient(): Promise<RedisClientType<RedisModules, RedisFunctions, RedisScripts, 2 | 3, TypeMapping>>;
}
export {};
//# sourceMappingURL=index.d.ts.map