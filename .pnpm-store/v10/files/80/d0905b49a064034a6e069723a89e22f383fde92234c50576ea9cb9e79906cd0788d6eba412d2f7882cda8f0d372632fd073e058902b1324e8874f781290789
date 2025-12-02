import { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { a as RealtimeClient } from '../client-mSdYPPkK.js';

/**
 * Simple Node.js relay server for the OpenAI Realtime API.
 *
 * @example
 *
 * ```ts
 * import { RealtimeClient } from 'openai-realtime-api'
 * import { RealtimeRelay } from 'openai-realtime-api/node'
 *
 * const client = new RealtimeClient({ relay: true })
 * const relay = new RealtimeRelay({ client })
 * relay.listen(8081)
 * ```
 */
declare class RealtimeRelay {
    readonly client: RealtimeClient;
    wss?: WebSocketServer;
    constructor({ client }: {
        client: RealtimeClient;
    });
    /**
     * Creates a `WebSocketServer` and begins listening for connections.
     *
     * @param port Port to listen on; defaults to the PORT environment variable or 8081.
     */
    listen(port?: number): void;
    /**
     * Closes the WebSocket server.
     */
    close(): void;
    protected _connectionHandler(ws: WebSocket, req: IncomingMessage): Promise<void>;
    protected _info(...args: any[]): void;
    protected _debug(...args: any[]): void;
    protected _error(...args: any[]): void;
}

export { RealtimeRelay };
