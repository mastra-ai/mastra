/// <reference types="node" />
import EventEmitter from 'node:events';
import { RedisClientOptions } from '../client';
import { PubSubListener } from '../client/pub-sub';
import { RedisNode } from './types';
type OnError = (err: unknown) => unknown;
export declare class PubSubProxy extends EventEmitter {
    #private;
    constructor(clientOptions: RedisClientOptions, onError: OnError);
    changeNode(node: RedisNode): Promise<void>;
    subscribe<T extends boolean = false>(channels: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void> | Promise<Promise<void> | undefined>;
    unsubscribe<T extends boolean = false>(channels?: string | Array<string>, listener?: PubSubListener<boolean>, bufferMode?: T): Promise<void | undefined>;
    pSubscribe<T extends boolean = false>(patterns: string | Array<string>, listener: PubSubListener<T>, bufferMode?: T): Promise<void | undefined>;
    pUnsubscribe<T extends boolean = false>(patterns?: string | Array<string>, listener?: PubSubListener<T>, bufferMode?: T): Promise<void | undefined>;
    destroy(): void;
}
export {};
//# sourceMappingURL=pub-sub-proxy.d.ts.map