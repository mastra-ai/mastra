import { AbstractClient } from "./AbstractClient";
import { CONNECTION_STATE, SOCKET_STATES } from "../lib/constants";
import type { DeepgramClientOptions, LiveSchema } from "../lib/types";
import type { WebSocket as WSWebSocket } from "ws";
/**
 * Represents a constructor for a WebSocket-like object that can be used in the application.
 * The constructor takes the following parameters:
 * @param address - The URL or address of the WebSocket server.
 * @param _ignored - An optional parameter that is ignored.
 * @param options - An optional object containing headers to be included in the WebSocket connection.
 * @returns A WebSocket-like object that implements the WebSocketLike interface.
 */
interface WebSocketLikeConstructor {
    new (address: string | URL, _ignored?: any, options?: {
        headers: object | undefined;
    }): WebSocketLike;
}
/**
 * Represents the types of WebSocket-like connections that can be used in the application.
 * This type is used to provide a common interface for different WebSocket implementations,
 * such as the native WebSocket API, a WebSocket wrapper library, or a dummy implementation
 * for testing purposes.
 */
declare type WebSocketLike = WebSocket | WSWebSocket | WSWebSocketDummy;
/**
 * Represents the types of data that can be sent or received over a WebSocket-like connection.
 */
declare type SocketDataLike = string | ArrayBufferLike | Blob;
/**
 * Represents an abstract live client that extends the AbstractClient class.
 * The AbstractLiveClient class provides functionality for connecting, reconnecting, and disconnecting a WebSocket connection, as well as sending data over the connection.
 * Subclasses of this class are responsible for setting up the connection event handlers.
 *
 * @abstract
 */
export declare abstract class AbstractLiveClient extends AbstractClient {
    headers: {
        [key: string]: string;
    };
    transport: WebSocketLikeConstructor | null;
    conn: WebSocketLike | null;
    sendBuffer: Function[];
    constructor(options: DeepgramClientOptions);
    /**
     * Connects the socket, unless already connected.
     *
     * @protected Can only be called from within the class.
     */
    protected connect(transcriptionOptions: LiveSchema, endpoint: string): void;
    /**
     * Reconnects the socket using new or existing transcription options.
     *
     * @param options - The transcription options to use when reconnecting the socket.
     */
    reconnect: (options: LiveSchema) => void;
    /**
     * Disconnects the socket from the client.
     *
     * @param code A numeric status code to send on disconnect.
     * @param reason A custom reason for the disconnect.
     */
    disconnect(code?: number, reason?: string): void;
    /**
     * Returns the current connection state of the WebSocket connection.
     *
     * @returns The current connection state of the WebSocket connection.
     */
    connectionState(): CONNECTION_STATE;
    /**
     * Returns the current ready state of the WebSocket connection.
     *
     * @returns The current ready state of the WebSocket connection.
     */
    getReadyState(): SOCKET_STATES;
    /**
     * Returns `true` is the connection is open.
     */
    isConnected(): boolean;
    /**
     * Sends data to the Deepgram API via websocket connection
     * @param data Audio data to send to Deepgram
     *
     * Conforms to RFC #146 for Node.js - does not send an empty byte.
     * @see https://github.com/deepgram/deepgram-python-sdk/issues/146
     */
    send(data: SocketDataLike): void;
    /**
     * Determines whether the current instance should proxy requests.
     * @returns {boolean} true if the current instance should proxy requests; otherwise, false
     */
    get proxy(): boolean;
    /**
     * Sets up the connection event handlers.
     *
     * @abstract Requires subclasses to set up context aware event handlers.
     */
    abstract setupConnection(): void;
}
declare class WSWebSocketDummy {
    binaryType: string;
    close: Function;
    onclose: Function;
    onerror: Function;
    onmessage: Function;
    onopen: Function;
    readyState: number;
    send: Function;
    url: string | URL | null;
    constructor(address: URL, _protocols: undefined, options: {
        close: Function;
    });
}
export { AbstractLiveClient as AbstractWsClient };
//# sourceMappingURL=AbstractLiveClient.d.ts.map