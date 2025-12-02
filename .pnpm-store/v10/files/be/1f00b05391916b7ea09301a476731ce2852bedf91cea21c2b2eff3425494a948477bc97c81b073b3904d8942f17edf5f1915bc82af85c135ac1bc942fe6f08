import { RedisClientOptions } from '../client';
import { CommandOptions } from '../client/commands-queue';
import { CommandSignature, CommanderConfig, RedisFunctions, RedisModules, RedisScripts, RespVersions, TypeMapping } from '../RESP/types';
import COMMANDS from '../commands';
import RedisSentinel, { RedisSentinelClient } from '.';
import { RedisTcpSocketOptions } from '../client/socket';
import { ClientSideCacheConfig, PooledClientSideCacheProvider } from '../client/cache';
export interface RedisNode {
    host: string;
    port: number;
}
export interface RedisSentinelOptions<M extends RedisModules = RedisModules, F extends RedisFunctions = RedisFunctions, S extends RedisScripts = RedisScripts, RESP extends RespVersions = RespVersions, TYPE_MAPPING extends TypeMapping = TypeMapping> extends SentinelCommander<M, F, S, RESP, TYPE_MAPPING> {
    /**
     * The sentinel identifier for a particular database cluster
     */
    name: string;
    /**
     * An array of root nodes that are part of the sentinel cluster, which will be used to get the topology. Each element in the array is a client configuration object. There is no need to specify every node in the cluster: 3 should be enough to reliably connect and obtain the sentinel configuration from the server
     */
    sentinelRootNodes: Array<RedisNode>;
    /**
     * The maximum number of times a command will retry due to topology changes.
     */
    maxCommandRediscovers?: number;
    /**
     * The configuration values for every node in the cluster. Use this for example when specifying an ACL user to connect with
     */
    nodeClientOptions?: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts, RESP, TYPE_MAPPING, RedisTcpSocketOptions>;
    /**
     * The configuration values for every sentinel in the cluster. Use this for example when specifying an ACL user to connect with
     */
    sentinelClientOptions?: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts, RESP, TYPE_MAPPING, RedisTcpSocketOptions>;
    /**
     * The number of clients connected to the master node
     */
    masterPoolSize?: number;
    /**
     * The number of clients connected to each replica node.
     * When greater than 0, the client will distribute the load by executing read-only commands (such as `GET`, `GEOSEARCH`, etc.) across all the cluster nodes.
     */
    replicaPoolSize?: number;
    /**
     * Interval in milliseconds to periodically scan for changes in the sentinel topology.
     * The client will query the sentinel for changes at this interval.
     *
     * Default: 10000 (10 seconds)
     */
    scanInterval?: number;
    /**
     * When `true`, error events from client instances inside the sentinel will be propagated to the sentinel instance.
     * This allows handling all client errors through a single error handler on the sentinel instance.
     *
     * Default: false
     */
    passthroughClientErrorEvents?: boolean;
    /**
     * When `true`, one client will be reserved for the sentinel object.
     * When `false`, the sentinel object will wait for the first available client from the pool.
     */
    reserveClient?: boolean;
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
     * const client = createSentinel({
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
     * const client = createSentinel({
     *   clientSideCache: cache,
     *   minimum: 5
     * });
     * ```
     */
    clientSideCache?: PooledClientSideCacheProvider | ClientSideCacheConfig;
}
export interface SentinelCommander<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> extends CommanderConfig<M, F, S, RESP> {
    commandOptions?: CommandOptions<TYPE_MAPPING>;
}
export type RedisSentinelClientOptions = Omit<RedisClientOptions, keyof SentinelCommander<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>>;
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
export type RedisSentinelClientType<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}> = (RedisSentinelClient<M, F, S, RESP, TYPE_MAPPING> & WithCommands<RESP, TYPE_MAPPING> & WithModules<M, RESP, TYPE_MAPPING> & WithFunctions<F, RESP, TYPE_MAPPING> & WithScripts<S, RESP, TYPE_MAPPING>);
export type RedisSentinelType<M extends RedisModules = {}, F extends RedisFunctions = {}, S extends RedisScripts = {}, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = {}> = (RedisSentinel<M, F, S, RESP, TYPE_MAPPING> & WithCommands<RESP, TYPE_MAPPING> & WithModules<M, RESP, TYPE_MAPPING> & WithFunctions<F, RESP, TYPE_MAPPING> & WithScripts<S, RESP, TYPE_MAPPING>);
export interface SentinelCommandOptions<TYPE_MAPPING extends TypeMapping = TypeMapping> extends CommandOptions<TYPE_MAPPING> {
}
export type ProxySentinel = RedisSentinel<any, any, any, any, any>;
export type ProxySentinelClient = RedisSentinelClient<any, any, any, any, any>;
export type NamespaceProxySentinel = {
    _self: ProxySentinel;
};
export type NamespaceProxySentinelClient = {
    _self: ProxySentinelClient;
};
export type NodeInfo = {
    ip: any;
    port: any;
    flags: any;
};
export type RedisSentinelEvent = NodeChangeEvent | SizeChangeEvent;
export type NodeChangeEvent = {
    type: "SENTINEL_CHANGE" | "MASTER_CHANGE" | "REPLICA_ADD" | "REPLICA_REMOVE";
    node: RedisNode;
};
export type SizeChangeEvent = {
    type: "SENTINE_LIST_CHANGE";
    size: Number;
};
export type ClientErrorEvent = {
    type: 'MASTER' | 'REPLICA' | 'SENTINEL' | 'PUBSUBPROXY';
    node: RedisNode;
    error: Error;
};
export {};
//# sourceMappingURL=types.d.ts.map