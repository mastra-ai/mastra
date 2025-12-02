/// <reference types="node" />
/// <reference types="node" />
import { RedisClusterOptions } from '.';
import { RedisClientType } from '../client';
import { EventEmitter } from 'node:stream';
import { ChannelListeners } from '../client/pub-sub';
import { RedisArgument, RedisFunctions, RedisModules, RedisScripts, RespVersions, TypeMapping } from '../RESP/types';
import { PooledClientSideCacheProvider } from '../client/cache';
interface NodeAddress {
    host: string;
    port: number;
}
export type NodeAddressMap = {
    [address: string]: NodeAddress;
} | ((address: string) => NodeAddress | undefined);
export interface Node<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> {
    address: string;
    client?: RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
    connectPromise?: Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
}
export interface ShardNode<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> extends Node<M, F, S, RESP, TYPE_MAPPING>, NodeAddress {
    id: string;
    readonly: boolean;
}
export interface MasterNode<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> extends ShardNode<M, F, S, RESP, TYPE_MAPPING> {
    pubSub?: {
        connectPromise?: Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
        client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
    };
}
export interface Shard<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> {
    master: MasterNode<M, F, S, RESP, TYPE_MAPPING>;
    replicas?: Array<ShardNode<M, F, S, RESP, TYPE_MAPPING>>;
    nodesIterator?: IterableIterator<ShardNode<M, F, S, RESP, TYPE_MAPPING>>;
}
type PubSubNode<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = (Omit<Node<M, F, S, RESP, TYPE_MAPPING>, 'client'> & Required<Pick<Node<M, F, S, RESP, TYPE_MAPPING>, 'client'>>);
export type OnShardedChannelMovedError = (err: unknown, channel: string, listeners?: ChannelListeners) => void;
export default class RedisClusterSlots<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> {
    #private;
    slots: Shard<M, F, S, RESP, TYPE_MAPPING>[];
    masters: MasterNode<M, F, S, RESP, TYPE_MAPPING>[];
    replicas: ShardNode<M, F, S, RESP, TYPE_MAPPING>[];
    readonly nodeByAddress: Map<string, ShardNode<M, F, S, RESP, TYPE_MAPPING> | MasterNode<M, F, S, RESP, TYPE_MAPPING>>;
    pubSubNode?: PubSubNode<M, F, S, RESP, TYPE_MAPPING>;
    clientSideCache?: PooledClientSideCacheProvider;
    get isOpen(): boolean;
    constructor(options: RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING>, emit: EventEmitter['emit']);
    connect(): Promise<void>;
    nodeClient(node: ShardNode<M, F, S, RESP, TYPE_MAPPING>): RedisClientType<M, F, S, RESP, TYPE_MAPPING> | Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
    rediscover(startWith: RedisClientType<M, F, S, RESP>): Promise<void>;
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
    getClient(firstKey: RedisArgument | undefined, isReadonly: boolean | undefined): RedisClientType<M, F, S, RESP, TYPE_MAPPING> | Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
    _randomNodeIterator?: IterableIterator<ShardNode<M, F, S, RESP, TYPE_MAPPING>>;
    getRandomNode(): ShardNode<M, F, S, RESP, TYPE_MAPPING>;
    getSlotRandomNode(slotNumber: number): ShardNode<M, F, S, RESP, TYPE_MAPPING>;
    getMasterByAddress(address: string): RedisClientType<M, F, S, RESP, TYPE_MAPPING> | Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>> | undefined;
    getPubSubClient(): RedisClientType<M, F, S, RESP, TYPE_MAPPING> | Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
    executeUnsubscribeCommand(unsubscribe: (client: RedisClientType<M, F, S, RESP>) => Promise<void>): Promise<void>;
    getShardedPubSubClient(channel: string): RedisClientType<M, F, S, RESP, TYPE_MAPPING> | Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
    executeShardedUnsubscribeCommand(channel: string, unsubscribe: (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>) => Promise<void>): Promise<void>;
}
export {};
//# sourceMappingURL=cluster-slots.d.ts.map