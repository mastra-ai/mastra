/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import COMMANDS from '../commands';
import { RedisSocketOptions } from './socket';
import { CredentialsProvider } from '../authx';
import { CommandOptions } from './commands-queue';
import { EventEmitter } from 'node:events';
import { PubSubType, PubSubListener, PubSubTypeListeners, ChannelListeners } from './pub-sub';
import { Command, CommandSignature, TypeMapping, CommanderConfig, RedisFunctions, RedisModules, RedisScript, RedisScripts, ReplyUnion, RespVersions, RedisArgument, ReplyWithTypeMapping, SimpleStringReply, TransformReply } from '../RESP/types';
import { RedisClientMultiCommandType } from './multi-command';
import { MULTI_MODE, MultiMode, RedisMultiQueuedCommand } from '../multi-command';
import { ScanOptions, ScanCommonOptions } from '../commands/SCAN';
import { RedisLegacyClientType } from './legacy-mode';
import { RedisPoolOptions } from './pool';
import { RedisVariadicArgument } from '../commands/generic-transformers';
import { ClientSideCacheConfig, ClientSideCacheProvider } from './cache';
import { CommandParser } from './parser';
export interface RedisClientOptions<M extends RedisModules = RedisModules, F extends RedisFunctions = RedisFunctions, S extends RedisScripts = RedisScripts, RESP extends RespVersions = RespVersions, TYPE_MAPPING extends TypeMapping = TypeMapping, SocketOptions extends RedisSocketOptions = RedisSocketOptions> extends CommanderConfig<M, F, S, RESP> {
    /**
     * `redis[s]://[[username][:password]@][host][:port][/db-number]`
     * See [`redis`](https://www.iana.org/assignments/uri-schemes/prov/redis) and [`rediss`](https://www.iana.org/assignments/uri-schemes/prov/rediss) IANA registration for more details
     */
    url?: string;
    /**
     * Socket connection properties
     */
    socket?: SocketOptions;
    /**
     * ACL username ([see ACL guide](https://redis.io/topics/acl))
     */
    username?: string;
    /**
     * ACL password or the old "--requirepass" password
     */
    password?: string;
    /**
     * Provides credentials for authentication. Can be set directly or will be created internally
     * if username/password are provided instead. If both are supplied, this credentialsProvider
     * takes precedence over username/password.
     */
    credentialsProvider?: CredentialsProvider;
    /**
     * Client name ([see `CLIENT SETNAME`](https://redis.io/commands/client-setname))
     */
    name?: string;
    /**
     * Redis database number (see [`SELECT`](https://redis.io/commands/select) command)
     */
    database?: number;
    /**
     * Maximum length of the client's internal command queue
     */
    commandsQueueMaxLength?: number;
    /**
     * When `true`, commands are rejected when the client is reconnecting.
     * When `false`, commands are queued for execution after reconnection.
     */
    disableOfflineQueue?: boolean;
    /**
     * Connect in [`READONLY`](https://redis.io/commands/readonly) mode
     */
    readonly?: boolean;
    /**
     * Send `PING` command at interval (in ms).
     * Useful with Redis deployments that do not honor TCP Keep-Alive.
     */
    pingInterval?: number;
    /**
     * Default command options to be applied to all commands executed through this client.
     *
     * These options can be overridden on a per-command basis when calling specific commands.
     *
     * @property {symbol} [chainId] - Identifier for chaining commands together
     * @property {boolean} [asap] - When true, the command is executed as soon as possible
     * @property {AbortSignal} [abortSignal] - AbortSignal to cancel the command
     * @property {TypeMapping} [typeMapping] - Custom type mappings between RESP and JavaScript types
     *
     * @example Setting default command options
     * ```
     * const client = createClient({
     *   commandOptions: {
     *     asap: true,
     *     typeMapping: {
     *       // Custom type mapping configuration
     *     }
     *   }
     * });
     * ```
     */
    commandOptions?: CommandOptions<TYPE_MAPPING>;
    /**
     * Client Side Caching configuration.
     *
     * Enables Redis Servers and Clients to work together to cache results from commands
     * sent to a server. The server will notify the client when cached results are no longer valid.
     *
     * Note: Client Side Caching is only supported with RESP3.
     *
     * @example Anonymous cache configuration
     * ```
     * const client = createClient({
     *   RESP: 3,
     *   clientSideCache: {
     *     ttl: 0,
     *     maxEntries: 0,
     *     evictPolicy: "LRU"
     *   }
     * });
     * ```
     *
     * @example Using a controllable cache
     * ```
     * const cache = new BasicClientSideCache({
     *   ttl: 0,
     *   maxEntries: 0,
     *   evictPolicy: "LRU"
     * });
     * const client = createClient({
     *   RESP: 3,
     *   clientSideCache: cache
     * });
     * ```
     */
    clientSideCache?: ClientSideCacheProvider | ClientSideCacheConfig;
    /**
     * If set to true, disables sending client identifier (user-agent like message) to the redis server
     */
    disableClientInfo?: boolean;
    /**
     * Tag to append to library name that is sent to the Redis server
     */
    clientInfoTag?: string;
}
type WithCommands<RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof typeof COMMANDS]: CommandSignature<(typeof COMMANDS)[P], RESP, TYPE_MAPPING>;
};
type WithModules<M extends RedisModules, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof M]: {
        [C in keyof M[P]]: CommandSignature<M[P][C], RESP, TYPE_MAPPING>;
    };
};
type WithFunctions<F extends RedisFunctions, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [L in keyof F]: {
        [C in keyof F[L]]: CommandSignature<F[L][C], RESP, TYPE_MAPPING>;
    };
};
type WithScripts<S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof S]: CommandSignature<S[P], RESP, TYPE_MAPPING>;
};
export type RedisClientExtensions<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}> = (WithCommands<RESP, TYPE_MAPPING> & WithModules<M, RESP, TYPE_MAPPING> & WithFunctions<F, RESP, TYPE_MAPPING> & WithScripts<S, RESP, TYPE_MAPPING>);
export type RedisClientType<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}> = (RedisClient<M, F, S, RESP, TYPE_MAPPING> & RedisClientExtensions<M, F, S, RESP, TYPE_MAPPING>);
interface ScanIteratorOptions {
    cursor?: RedisArgument;
}
export type MonitorCallback<TYPE_MAPPING extends TypeMapping = TypeMapping> = (reply: ReplyWithTypeMapping<SimpleStringReply, TYPE_MAPPING>) => unknown;
export default class RedisClient<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> extends EventEmitter {
    #private;
    static factory<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2>(config?: CommanderConfig<M, F, S, RESP>): <TYPE_MAPPING extends TypeMapping = {}>(options?: Omit<RedisClientOptions<M, F, S, RESP, TYPE_MAPPING, RedisSocketOptions>, keyof CommanderConfig<M, F, S, RESP>> | undefined) => RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
    static create<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}>(this: void, options?: RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>): RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
    static parseOptions<O extends RedisClientOptions>(options: O): O;
    static parseURL(url: string): RedisClientOptions & {
        socket: Exclude<RedisClientOptions['socket'], undefined> & {
            tls: boolean;
        };
    };
    private _self;
    private _commandOptions?;
    get clientSideCache(): ClientSideCacheProvider | undefined;
    get options(): RedisClientOptions<M, F, S, RESP> | undefined;
    get isOpen(): boolean;
    get isReady(): boolean;
    get isPubSubActive(): boolean;
    get socketEpoch(): number;
    get isWatching(): boolean;
    /**
     * Indicates whether the client's WATCH command has been invalidated by a topology change.
     * When this returns true, any transaction using WATCH will fail with a WatchError.
     * @returns true if the watched keys have been modified, false otherwise
     */
    get isDirtyWatch(): boolean;
    /**
     * Marks the client's WATCH command as invalidated due to a topology change.
     * This will cause any subsequent EXEC in a transaction to fail with a WatchError.
     * @param msg - The error message explaining why the WATCH is dirty
     */
    setDirtyWatch(msg: string): void;
    constructor(options?: RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>);
    /**
     * @param credentials
     */
    private reAuthenticate;
    withCommandOptions<OPTIONS extends CommandOptions<TYPE_MAPPING>, TYPE_MAPPING extends TypeMapping>(options: OPTIONS): RedisClientType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    private _commandOptionsProxy;
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping<TYPE_MAPPING extends TypeMapping>(typeMapping: TYPE_MAPPING): RedisClientType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    /**
     * Override the `abortSignal` command option
     */
    withAbortSignal(abortSignal: AbortSignal): RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
    /**
     * Override the `asap` command option to `true`
     */
    asap(): RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
    /**
     * Create the "legacy" (v3/callback) interface
     */
    legacy(): RedisLegacyClientType;
    /**
     * Create {@link RedisClientPool `RedisClientPool`} using this client as a prototype
     */
    createPool(options?: Partial<RedisPoolOptions>): import("./pool").RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING>;
    duplicate<_M extends RedisModules = M, _F extends RedisFunctions = F, _S extends RedisScripts = S, _RESP extends RespVersions = RESP, _TYPE_MAPPING extends TypeMapping = TYPE_MAPPING>(overrides?: Partial<RedisClientOptions<_M, _F, _S, _RESP, _TYPE_MAPPING>>): RedisClientType<_M, _F, _S, _RESP, _TYPE_MAPPING>;
    connect(): Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
    /**
     * @internal
     */
    _executeCommand(command: Command, parser: CommandParser, commandOptions: CommandOptions<TYPE_MAPPING> | undefined, transformReply: TransformReply | undefined): Promise<any>;
    /**
     * @internal
     */
    _executeScript(script: RedisScript, parser: CommandParser, options: CommandOptions | undefined, transformReply: TransformReply | undefined): Promise<any>;
    sendCommand<T = ReplyUnion>(args: ReadonlyArray<RedisArgument>, options?: CommandOptions): Promise<T>;
    SELECT(db: number): Promise<void>;
    select: (db: number) => Promise<void>;
    SUBSCRIBE<T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void>;
    subscribe: <T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T | undefined) => Promise<void>;
    UNSUBSCRIBE<T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<T>, bufferMode?: T): Promise<void>;
    unsubscribe: <T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<T> | undefined, bufferMode?: T | undefined) => Promise<void>;
    PSUBSCRIBE<T extends boolean = false>(patterns: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void>;
    pSubscribe: <T extends boolean = false>(patterns: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T | undefined) => Promise<void>;
    PUNSUBSCRIBE<T extends boolean = false>(patterns?: string | Array<string>, listener?: PubSubListener<T>, bufferMode?: T): Promise<void>;
    pUnsubscribe: <T extends boolean = false>(patterns?: string | Array<string>, listener?: PubSubListener<T> | undefined, bufferMode?: T | undefined) => Promise<void>;
    SSUBSCRIBE<T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void>;
    sSubscribe: <T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T | undefined) => Promise<void>;
    SUNSUBSCRIBE<T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<T>, bufferMode?: T): Promise<void>;
    sUnsubscribe: <T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<T> | undefined, bufferMode?: T | undefined) => Promise<void>;
    WATCH(key: RedisVariadicArgument): Promise<TYPE_MAPPING[43] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<"OK", T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> : "OK">;
    watch: (key: RedisVariadicArgument) => Promise<TYPE_MAPPING[43] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<"OK", T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> : "OK">;
    UNWATCH(): Promise<TYPE_MAPPING[43] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<"OK", T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> : "OK">;
    unwatch: () => Promise<TYPE_MAPPING[43] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<"OK", T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> : "OK">;
    getPubSubListeners(type: PubSubType): PubSubTypeListeners;
    extendPubSubChannelListeners(type: PubSubType, channel: string, listeners: ChannelListeners): Promise<void>;
    extendPubSubListeners(type: PubSubType, listeners: PubSubTypeListeners): Promise<void>;
    /**
     * @internal
     */
    _executePipeline(commands: Array<RedisMultiQueuedCommand>, selectedDB?: number): Promise<unknown[]>;
    /**
     * @internal
     */
    _executeMulti(commands: Array<RedisMultiQueuedCommand>, selectedDB?: number): Promise<unknown[]>;
    MULTI<isTyped extends MultiMode = MULTI_MODE['TYPED']>(): RedisClientMultiCommandType<isTyped, [], M, F, S, RESP, TYPE_MAPPING>;
    multi: <isTyped extends MultiMode = "typed">() => RedisClientMultiCommandType<isTyped, [], M, F, S, RESP, TYPE_MAPPING>;
    scanIterator(this: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, options?: ScanOptions & ScanIteratorOptions): AsyncGenerator<TYPE_MAPPING[42] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<import("../RESP/types").BlobStringReply<string>[], T>, TYPE_MAPPING> : (TYPE_MAPPING[36] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<string, T>, TYPE_MAPPING> : string)[], void, unknown>;
    hScanIterator(this: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, key: RedisArgument, options?: ScanCommonOptions & ScanIteratorOptions): AsyncGenerator<{
        field: TYPE_MAPPING[36] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<string, T>, TYPE_MAPPING> : string;
        value: TYPE_MAPPING[36] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<string, T>, TYPE_MAPPING> : string;
    }[], void, unknown>;
    hScanValuesIterator(this: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, key: RedisArgument, options?: ScanCommonOptions & ScanIteratorOptions): AsyncGenerator<(TYPE_MAPPING[36] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<string, T>, TYPE_MAPPING> : string)[], void, unknown>;
    hScanNoValuesIterator(this: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, key: RedisArgument, options?: ScanCommonOptions & ScanIteratorOptions): AsyncGenerator<(TYPE_MAPPING[36] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<string, T>, TYPE_MAPPING> : string)[], void, unknown>;
    sScanIterator(this: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, key: RedisArgument, options?: ScanCommonOptions & ScanIteratorOptions): AsyncGenerator<(TYPE_MAPPING[36] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<string, T>, TYPE_MAPPING> : string)[], void, unknown>;
    zScanIterator(this: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, key: RedisArgument, options?: ScanCommonOptions & ScanIteratorOptions): AsyncGenerator<{
        value: TYPE_MAPPING[36] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<Buffer, T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<string, T>, TYPE_MAPPING> : string;
        score: TYPE_MAPPING[44] extends import("../RESP/types").MappedType<infer T> ? ReplyWithTypeMapping<Extract<number, T>, TYPE_MAPPING> | ReplyWithTypeMapping<Extract<`${number}`, T>, TYPE_MAPPING> : number;
    }[], void, unknown>;
    MONITOR(callback: MonitorCallback<TYPE_MAPPING>): Promise<void>;
    monitor: (callback: MonitorCallback<TYPE_MAPPING>) => Promise<void>;
    /**
     * Reset the client to its default state (i.e. stop PubSub, stop monitoring, select default DB, etc.)
     */
    reset(): Promise<void>;
    /**
     * If the client has state, reset it.
     * An internal function to be used by wrapper class such as `RedisClientPool`.
     * @internal
     */
    resetIfDirty(): Promise<void> | undefined;
    /**
     * @deprecated use .close instead
     */
    QUIT(): Promise<string>;
    quit: () => Promise<string>;
    /**
     * @deprecated use .destroy instead
     */
    disconnect(): Promise<void>;
    /**
     * Close the client. Wait for pending commands.
     */
    close(): Promise<void>;
    /**
     * Destroy the client. Rejects all commands immediately.
     */
    destroy(): void;
    ref(): void;
    unref(): void;
}
export {};
//# sourceMappingURL=index.d.ts.map