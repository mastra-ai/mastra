import WebSocket from "ws";
export declare const nodeWebSocket: {
    new (url: string | URL, protocols?: string | string[] | undefined): globalThis.WebSocket;
    prototype: globalThis.WebSocket;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
};
import { ClientMessage, WireServerMessage } from "./protocol.js";
import { QueryToken } from "./udf_path_utils.js";
import { BaseConvexClient } from "./client.js";
export type InMemoryWebSocketTest = (args: {
    address: string;
    socket: () => WebSocket;
    receive: () => Promise<ClientMessage>;
    send: (message: WireServerMessage) => void;
    close: () => void;
}) => Promise<void>;
export declare function withInMemoryWebSocket(cb: InMemoryWebSocketTest, debug?: boolean): Promise<void>;
export declare function encodeServerMessage(message: WireServerMessage): string;
/**
 * const q = new UpdateQueue();
 * const client = new Client("http://...", q.onTransition);
 *
 * await q.updatePromises[3];
 *
 */
export declare class UpdateQueue {
    updateResolves: ((v: Record<QueryToken, any>) => void)[];
    updatePromises: Promise<Record<QueryToken, any>>[];
    updates: Record<QueryToken, any>[];
    allResults: Record<QueryToken, any>;
    nextIndex: number;
    constructor(maxLength?: number);
    /**
     * Useful to use instead of directly awaiting so that the timeout has a line number
     * unlike the default Vite test timeout.
     */
    awaitPromiseAtIndexWithTimeout(i: number): Promise<unknown>;
    onTransition: (client: BaseConvexClient) => (updatedQueryTokens: QueryToken[]) => void;
}
//# sourceMappingURL=client_node_test_helpers.d.ts.map