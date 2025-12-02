/// <reference types="node" />
import { Decoder } from '../RESP/decoder';
import { TypeMapping, RespVersions, RedisArgument } from '../RESP/types';
import { ChannelListeners, PubSubListener, PubSubType, PubSubTypeListeners } from './pub-sub';
import { MonitorCallback } from '.';
export interface CommandOptions<T = TypeMapping> {
    chainId?: symbol;
    asap?: boolean;
    abortSignal?: AbortSignal;
    /**
     * Maps between RESP and JavaScript types
     */
    typeMapping?: T;
    /**
     * Timeout for the command in milliseconds
     */
    timeout?: number;
}
export interface CommandToWrite extends CommandWaitingForReply {
    args: ReadonlyArray<RedisArgument>;
    chainId: symbol | undefined;
    abort: {
        signal: AbortSignal;
        listener: () => unknown;
    } | undefined;
    timeout: {
        signal: AbortSignal;
        listener: () => unknown;
    } | undefined;
}
interface CommandWaitingForReply {
    resolve(reply?: unknown): void;
    reject(err: unknown): void;
    channelsCounter: number | undefined;
    typeMapping: TypeMapping | undefined;
}
export type OnShardedChannelMoved = (channel: string, listeners: ChannelListeners) => void;
export default class RedisCommandsQueue {
    #private;
    readonly decoder: Decoder;
    get isPubSubActive(): boolean;
    constructor(respVersion: RespVersions, maxLength: number | null | undefined, onShardedChannelMoved: OnShardedChannelMoved);
    setInvalidateCallback(callback?: (key: RedisArgument | null) => unknown): void;
    addCommand<T>(args: ReadonlyArray<RedisArgument>, options?: CommandOptions): Promise<T>;
    subscribe<T extends boolean>(type: PubSubType, channels: string | Array<string>, listener: PubSubListener<T>, returnBuffers?: T): Promise<void> | undefined;
    unsubscribe<T extends boolean>(type: PubSubType, channels?: string | Array<string>, listener?: PubSubListener<T>, returnBuffers?: T): Promise<void> | undefined;
    resubscribe(chainId?: symbol): Promise<void[]> | undefined;
    extendPubSubChannelListeners(type: PubSubType, channel: string, listeners: ChannelListeners): Promise<void> | undefined;
    extendPubSubListeners(type: PubSubType, listeners: PubSubTypeListeners): Promise<void> | undefined;
    getPubSubListeners(type: PubSubType): PubSubTypeListeners;
    monitor(callback: MonitorCallback, options?: CommandOptions): Promise<void>;
    resetDecoder(): void;
    reset<T extends TypeMapping>(chainId: symbol, typeMapping?: T): Promise<unknown>;
    isWaitingToWrite(): boolean;
    commandsToWrite(): Generator<readonly RedisArgument[], void, unknown>;
    flushWaitingForReply(err: Error): void;
    flushAll(err: Error): void;
    isEmpty(): boolean;
}
export {};
//# sourceMappingURL=commands-queue.d.ts.map