/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { EventEmitter } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';
import { RedisArgument } from '../RESP/types';
type NetOptions = {
    tls?: false;
};
type ReconnectStrategyFunction = (retries: number, cause: Error) => false | Error | number;
type RedisSocketOptionsCommon = {
    /**
     * Connection timeout (in milliseconds)
     */
    connectTimeout?: number;
    /**
     * When the socket closes unexpectedly (without calling `.close()`/`.destroy()`), the client uses `reconnectStrategy` to decide what to do. The following values are supported:
     * 1. `false` -> do not reconnect, close the client and flush the command queue.
     * 2. `number` -> wait for `X` milliseconds before reconnecting.
     * 3. `(retries: number, cause: Error) => false | number | Error` -> `number` is the same as configuring a `number` directly, `Error` is the same as `false`, but with a custom error.
     */
    reconnectStrategy?: false | number | ReconnectStrategyFunction;
    /**
     * The timeout (in milliseconds) after which the socket will be closed. `undefined` means no timeout.
     */
    socketTimeout?: number;
};
type RedisTcpOptions = RedisSocketOptionsCommon & NetOptions & Omit<net.TcpNetConnectOpts, 'timeout' | 'onread' | 'readable' | 'writable' | 'port'> & {
    port?: number;
};
type RedisTlsOptions = RedisSocketOptionsCommon & tls.ConnectionOptions & {
    tls: true;
};
type RedisIpcOptions = RedisSocketOptionsCommon & Omit<net.IpcNetConnectOpts, 'timeout' | 'onread' | 'readable' | 'writable'> & {
    tls: false;
};
export type RedisTcpSocketOptions = RedisTcpOptions | RedisTlsOptions;
export type RedisSocketOptions = RedisTcpSocketOptions | RedisIpcOptions;
export type RedisSocketInitiator = () => void | Promise<unknown>;
export default class RedisSocket extends EventEmitter {
    #private;
    get isOpen(): boolean;
    get isReady(): boolean;
    get socketEpoch(): number;
    constructor(initiator: RedisSocketInitiator, options?: RedisSocketOptions);
    connect(): Promise<void>;
    write(iterable: Iterable<ReadonlyArray<RedisArgument>>): void;
    quit<T>(fn: () => Promise<T>): Promise<T>;
    close(): void;
    destroy(): void;
    destroySocket(): void;
    ref(): void;
    unref(): void;
    defaultReconnectStrategy(retries: number, cause: unknown): number | false;
}
export {};
//# sourceMappingURL=socket.d.ts.map