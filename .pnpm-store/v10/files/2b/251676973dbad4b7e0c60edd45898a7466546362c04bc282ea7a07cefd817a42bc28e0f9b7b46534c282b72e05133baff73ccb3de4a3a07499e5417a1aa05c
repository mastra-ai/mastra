import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from 'hono';
import type { SSEStreamingApi } from 'hono/streaming';
export declare class SSETransport implements Transport {
    private messageUrl;
    private stream;
    private _sessionId;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;
    /**
     * Creates a new SSETransport, which will direct the MPC client to POST messages to messageUrl
     */
    constructor(messageUrl: string, stream: SSEStreamingApi);
    get sessionId(): string;
    start(): Promise<void>;
    handlePostMessage(context: Context): Promise<Response>;
    /**
     * Handle a client message, regardless of how it arrived. This can be used to inform the server of messages that arrive via a means different than HTTP POST.
     */
    handleMessage(message: unknown): Promise<void>;
    close(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
}
