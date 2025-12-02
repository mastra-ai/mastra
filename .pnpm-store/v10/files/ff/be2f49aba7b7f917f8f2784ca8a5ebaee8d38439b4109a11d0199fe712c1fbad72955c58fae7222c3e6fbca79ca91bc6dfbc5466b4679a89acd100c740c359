import { Logger } from "../logging.js";
import { ClientMessage, ServerMessage } from "./protocol.js";
export type ReconnectMetadata = {
    connectionCount: number;
    lastCloseReason: string | null;
    clientTs: number;
};
export type OnMessageResponse = {
    hasSyncedPastLastReconnect: boolean;
};
/**
 * A wrapper around a websocket that handles errors, reconnection, and message
 * parsing.
 */
export declare class WebSocketManager {
    private readonly markConnectionStateDirty;
    private readonly debug;
    private socket;
    private connectionCount;
    private _hasEverConnected;
    private lastCloseReason;
    private transitionChunkBuffer;
    /** Upon HTTPS/WSS failure, the first jittered backoff duration, in ms. */
    private readonly defaultInitialBackoff;
    /** We backoff exponentially, but we need to cap that--this is the jittered max. */
    private readonly maxBackoff;
    /** How many times have we failed consecutively? */
    private retries;
    /** How long before lack of server response causes us to initiate a reconnect,
     * in ms */
    private readonly serverInactivityThreshold;
    private reconnectDueToServerInactivityTimeout;
    private readonly uri;
    private readonly onOpen;
    private readonly onResume;
    private readonly onMessage;
    private readonly webSocketConstructor;
    private readonly logger;
    private readonly onServerDisconnectError;
    constructor(uri: string, callbacks: {
        onOpen: (reconnectMetadata: ReconnectMetadata) => void;
        onResume: () => void;
        onMessage: (message: ServerMessage) => OnMessageResponse;
        onServerDisconnectError?: ((message: string) => void) | undefined;
    }, webSocketConstructor: typeof WebSocket, logger: Logger, markConnectionStateDirty: () => void, debug: boolean);
    private setSocketState;
    private assembleTransition;
    private connect;
    /**
     * @returns The state of the {@link Socket}.
     */
    socketState(): string;
    /**
     * @param message - A ClientMessage to send.
     * @returns Whether the message (might have been) sent.
     */
    sendMessage(message: ClientMessage): boolean;
    private resetServerInactivityTimeout;
    private scheduleReconnect;
    /**
     * Close the WebSocket and schedule a reconnect.
     *
     * This should be used when we hit an error and would like to restart the session.
     */
    private closeAndReconnect;
    /**
     * Close the WebSocket, being careful to clear the onclose handler to avoid re-entrant
     * calls. Use this instead of directly calling `ws.close()`
     *
     * It is the callers responsibility to update the state after this method is called so that the
     * closed socket is not accessible or used again after this method is called
     */
    private close;
    /**
     * Close the WebSocket and do not reconnect.
     * @returns A Promise that resolves when the WebSocket `onClose` callback is called.
     */
    terminate(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Create a new WebSocket after a previous `stop()`, unless `terminate()` was
     * called before.
     */
    tryRestart(): void;
    pause(): void;
    /**
     * Resume the state machine if previously paused.
     */
    resume(): void;
    connectionState(): {
        isConnected: boolean;
        hasEverConnected: boolean;
        connectionCount: number;
        connectionRetries: number;
    };
    private _logVerbose;
    private nextBackoff;
    private reportLargeTransition;
}
//# sourceMappingURL=web_socket_manager.d.ts.map