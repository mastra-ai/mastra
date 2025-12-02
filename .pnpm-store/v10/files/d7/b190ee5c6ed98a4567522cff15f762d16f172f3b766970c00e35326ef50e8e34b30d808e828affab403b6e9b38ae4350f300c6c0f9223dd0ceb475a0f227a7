/// <reference types="node" />
import { RedisClientOptions, RedisClientType } from '../client';
import { CommandOptions } from '../client/commands-queue';
import { Command, CommandArguments, CommanderConfig, CommandSignature, /*CommandPolicies, CommandWithPoliciesSignature,*/ TypeMapping, RedisArgument, RedisFunctions, RedisModules, RedisScripts, ReplyUnion, RespVersions } from '../RESP/types';
import COMMANDS from '../commands';
import { EventEmitter } from 'node:events';
import RedisClusterSlots, { NodeAddressMap, ShardNode } from './cluster-slots';
import { RedisClusterMultiCommandType } from './multi-command';
import { PubSubListener } from '../client/pub-sub';
import { RedisTcpSocketOptions } from '../client/socket';
import { ClientSideCacheConfig, PooledClientSideCacheProvider } from '../client/cache';
interface ClusterCommander<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> extends CommanderConfig<M, F, S, RESP> {
    commandOptions?: ClusterCommandOptions<TYPE_MAPPING>;
}
export type RedisClusterClientOptions = Omit<RedisClientOptions<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping, RedisTcpSocketOptions>, keyof ClusterCommander<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>>;
export interface RedisClusterOptions<M extends RedisModules = RedisModules, F extends RedisFunctions = RedisFunctions, S extends RedisScripts = RedisScripts, RESP extends RespVersions = RespVersions, TYPE_MAPPING extends TypeMapping = TypeMapping> extends ClusterCommander<M, F, S, RESP, TYPE_MAPPING> {
    /**
     * Should contain details for some of the cluster nodes that the client will use to discover
     * the "cluster topology". We recommend including details for at least 3 nodes here.
     */
    rootNodes: Array<RedisClusterClientOptions>;
    /**
     * Default values used for every client in the cluster. Use this to specify global values,
     * for example: ACL credentials, timeouts, TLS configuration etc.
     */
    defaults?: Partial<RedisClusterClientOptions>;
    /**
     * When `true`, `.connect()` will only discover the cluster topology, without actually connecting to all the nodes.
     * Useful for short-term or PubSub-only connections.
     */
    minimizeConnections?: boolean;
    /**
     * When `true`, distribute load by executing readonly commands (such as `GET`, `GEOSEARCH`, etc.) across all cluster nodes. When `false`, only use master nodes.
     */
    useReplicas?: boolean;
    /**
     * The maximum number of times a command will be redirected due to `MOVED` or `ASK` errors.
     */
    maxCommandRedirections?: number;
    /**
     * Mapping between the addresses in the cluster (see `CLUSTER SHARDS`) and the addresses the client should connect to
     * Useful when the cluster is running on another network
     */
    nodeAddressMap?: NodeAddressMap;
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
     * const client = createCluster({
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
     * const client = createCluster({
     *   clientSideCache: cache,
     *   minimum: 5
     * });
     * ```
     */
    clientSideCache?: PooledClientSideCacheProvider | ClientSideCacheConfig;
}
type ClusterCommand<NAME extends PropertyKey, COMMAND extends Command> = COMMAND['NOT_KEYED_COMMAND'] extends true ? (COMMAND['IS_FORWARD_COMMAND'] extends true ? NAME : never) : NAME;
type WithCommands<RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof typeof COMMANDS as ClusterCommand<P, (typeof COMMANDS)[P]>]: CommandSignature<(typeof COMMANDS)[P], RESP, TYPE_MAPPING>;
};
type WithModules<M extends RedisModules, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof M]: {
        [C in keyof M[P] as ClusterCommand<C, M[P][C]>]: CommandSignature<M[P][C], RESP, TYPE_MAPPING>;
    };
};
type WithFunctions<F extends RedisFunctions, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [L in keyof F]: {
        [C in keyof F[L] as ClusterCommand<C, F[L][C]>]: CommandSignature<F[L][C], RESP, TYPE_MAPPING>;
    };
};
type WithScripts<S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof S as ClusterCommand<P, S[P]>]: CommandSignature<S[P], RESP, TYPE_MAPPING>;
};
export type RedisClusterType<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}> = (RedisCluster<M, F, S, RESP, TYPE_MAPPING> & WithCommands<RESP, TYPE_MAPPING> & WithModules<M, RESP, TYPE_MAPPING> & WithFunctions<F, RESP, TYPE_MAPPING> & WithScripts<S, RESP, TYPE_MAPPING>);
export interface ClusterCommandOptions<TYPE_MAPPING extends TypeMapping = TypeMapping> extends CommandOptions<TYPE_MAPPING> {
}
export default class RedisCluster<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> extends EventEmitter {
    #private;
    static factory<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}>(config?: ClusterCommander<M, F, S, RESP, TYPE_MAPPING>): (options?: Omit<RedisClusterOptions, keyof Exclude<typeof config, undefined>>) => RedisClusterType<M, F, S, RESP, TYPE_MAPPING>;
    static create<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}>(options?: RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING>): RedisClusterType<M, F, S, RESP, TYPE_MAPPING>;
    readonly _options: RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING>;
    readonly _slots: RedisClusterSlots<M, F, S, RESP, TYPE_MAPPING>;
    private _self;
    private _commandOptions?;
    /**
     * An array of the cluster slots, each slot contain its `master` and `replicas`.
     * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific node (master or replica).
     */
    get slots(): import("./cluster-slots").Shard<M, F, S, RESP, TYPE_MAPPING>[];
    get clientSideCache(): PooledClientSideCacheProvider | undefined;
    /**
     * An array of the cluster masters.
     * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific master node.
     */
    get masters(): import("./cluster-slots").MasterNode<M, F, S, RESP, TYPE_MAPPING>[];
    /**
     * An array of the cluster replicas.
     * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific replica node.
     */
    get replicas(): ShardNode<M, F, S, RESP, TYPE_MAPPING>[];
    /**
     * A map form a node address (`<host>:<port>`) to its shard, each shard contain its `master` and `replicas`.
     * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific node (master or replica).
     */
    get nodeByAddress(): Map<string, import("./cluster-slots").MasterNode<M, F, S, RESP, TYPE_MAPPING> | ShardNode<M, F, S, RESP, TYPE_MAPPING>>;
    /**
     * The current pub/sub node.
     */
    get pubSubNode(): (Omit<import("./cluster-slots").Node<M, F, S, RESP, TYPE_MAPPING>, "client"> & Required<Pick<import("./cluster-slots").Node<M, F, S, RESP, TYPE_MAPPING>, "client">>) | undefined;
    get isOpen(): boolean;
    constructor(options: RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING>);
    duplicate<_M extends RedisModules = M, _F extends RedisFunctions = F, _S extends RedisScripts = S, _RESP extends RespVersions = RESP, _TYPE_MAPPING extends TypeMapping = TYPE_MAPPING>(overrides?: Partial<RedisClusterOptions<_M, _F, _S, _RESP, _TYPE_MAPPING>>): RedisClusterType<_M, _F, _S, _RESP, _TYPE_MAPPING>;
    connect(): Promise<RedisClusterType<M, F, S, RESP, TYPE_MAPPING>>;
    withCommandOptions<OPTIONS extends ClusterCommandOptions<TYPE_MAPPING>, TYPE_MAPPING extends TypeMapping>(options: OPTIONS): RedisClusterType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    private _commandOptionsProxy;
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping<TYPE_MAPPING extends TypeMapping>(typeMapping: TYPE_MAPPING): RedisClusterType<M, F, S, RESP, TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}>;
    _handleAsk<T>(fn: (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, opts?: ClusterCommandOptions) => Promise<T>): (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, options?: ClusterCommandOptions) => Promise<T>;
    _execute<T>(firstKey: RedisArgument | undefined, isReadonly: boolean | undefined, options: ClusterCommandOptions | undefined, fn: (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, opts?: ClusterCommandOptions) => Promise<T>): Promise<T>;
    sendCommand<T = ReplyUnion>(firstKey: RedisArgument | undefined, isReadonly: boolean | undefined, args: CommandArguments, options?: ClusterCommandOptions): Promise<T>;
    MULTI(routing?: RedisArgument): RedisClusterMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING>;
    multi: (routing?: RedisArgument) => RedisClusterMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING>;
    SUBSCRIBE<T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void>;
    subscribe: <T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T | undefined) => Promise<void>;
    UNSUBSCRIBE<T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<boolean>, bufferMode?: T): Promise<void>;
    unsubscribe: <T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<boolean>, bufferMode?: T | undefined) => Promise<void>;
    PSUBSCRIBE<T extends boolean = false>(patterns: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void>;
    pSubscribe: <T extends boolean = false>(patterns: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T | undefined) => Promise<void>;
    PUNSUBSCRIBE<T extends boolean = false>(patterns?: string | Array<string>, listener?: PubSubListener<T>, bufferMode?: T): Promise<void>;
    pUnsubscribe: <T extends boolean = false>(patterns?: string | Array<string>, listener?: PubSubListener<T> | undefined, bufferMode?: T | undefined) => Promise<void>;
    SSUBSCRIBE<T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void>;
    sSubscribe: <T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T | undefined) => Promise<void>;
    SUNSUBSCRIBE<T extends boolean = false>(channels: string | Array<string>, listener?: PubSubListener<T>, bufferMode?: T): Promise<void>;
    sUnsubscribe: <T extends boolean = false>(channels: string | Array<string>, listener?: PubSubListener<T> | undefined, bufferMode?: T | undefined) => Promise<void>;
    /**
     * @deprecated Use `close` instead.
     */
    quit(): Promise<void>;
    /**
     * @deprecated Use `destroy` instead.
     */
    disconnect(): Promise<void>;
    close(): Promise<void>;
    destroy(): void;
    nodeClient(node: ShardNode<M, F, S, RESP, TYPE_MAPPING>): RedisClientType<M, F, S, RESP, TYPE_MAPPING> | Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
    /**
     * Returns a random node from the cluster.
     * Userful for running "forward" commands (like PUBLISH) on a random node.
     */
    getRandomNode(): ShardNode<M, F, S, RESP, TYPE_MAPPING>;
    /**
     * Get a random node from a slot.
     * Useful for running readonly commands on a slot.
     */
    getSlotRandomNode(slot: number): ShardNode<M, F, S, RESP, TYPE_MAPPING>;
    /**
     * @deprecated use `.masters` instead
     * TODO
     */
    getMasters(): import("./cluster-slots").MasterNode<M, F, S, RESP, TYPE_MAPPING>[];
    /**
     * @deprecated use `.slots[<SLOT>]` instead
     * TODO
     */
    getSlotMaster(slot: number): import("./cluster-slots").MasterNode<M, F, S, RESP, TYPE_MAPPING>;
}
export {};
//# sourceMappingURL=index.d.ts.map