/// <reference types="node" />
import { RedisArgument } from '../RESP/types';
import { CommandToWrite } from './commands-queue';
export declare const PUBSUB_TYPE: {
    readonly CHANNELS: "CHANNELS";
    readonly PATTERNS: "PATTERNS";
    readonly SHARDED: "SHARDED";
};
export type PUBSUB_TYPE = typeof PUBSUB_TYPE;
export type PubSubType = PUBSUB_TYPE[keyof PUBSUB_TYPE];
export type PubSubListener<RETURN_BUFFERS extends boolean = false> = <T extends RETURN_BUFFERS extends true ? Buffer : string>(message: T, channel: T) => unknown;
export interface ChannelListeners {
    unsubscribing: boolean;
    buffers: Set<PubSubListener<true>>;
    strings: Set<PubSubListener<false>>;
}
export type PubSubTypeListeners = Map<string, ChannelListeners>;
export type PubSubListeners = Record<PubSubType, PubSubTypeListeners>;
export type PubSubCommand = (Required<Pick<CommandToWrite, 'args' | 'channelsCounter' | 'resolve'>> & {
    reject: undefined | (() => unknown);
});
export declare class PubSub {
    #private;
    static isStatusReply(reply: Array<Buffer>): boolean;
    static isShardedUnsubscribe(reply: Array<Buffer>): boolean;
    get isActive(): boolean;
    readonly listeners: PubSubListeners;
    subscribe<T extends boolean>(type: PubSubType, channels: string | Array<string>, listener: PubSubListener<T>, returnBuffers?: T): {
        args: RedisArgument[];
        channelsCounter: number;
        resolve: () => void;
        reject: () => void;
    } | undefined;
    extendChannelListeners(type: PubSubType, channel: string, listeners: ChannelListeners): {
        args: (string | Buffer)[];
        channelsCounter: number;
        resolve: () => number;
        reject: () => void;
    } | undefined;
    extendTypeListeners(type: PubSubType, listeners: PubSubTypeListeners): {
        args: RedisArgument[];
        channelsCounter: number;
        resolve: () => number;
        reject: () => void;
    } | undefined;
    unsubscribe<T extends boolean>(type: PubSubType, channels?: string | Array<string>, listener?: PubSubListener<T>, returnBuffers?: T): {
        args: RedisArgument[];
        channelsCounter: number;
        resolve: () => void;
        reject: undefined;
    } | undefined;
    reset(): void;
    resubscribe(): {
        args: (string | Buffer)[];
        channelsCounter: number;
        resolve: () => number;
        reject: () => number;
    }[];
    handleMessageReply(reply: Array<Buffer>): boolean;
    removeShardedListeners(channel: string): ChannelListeners;
}
//# sourceMappingURL=pub-sub.d.ts.map