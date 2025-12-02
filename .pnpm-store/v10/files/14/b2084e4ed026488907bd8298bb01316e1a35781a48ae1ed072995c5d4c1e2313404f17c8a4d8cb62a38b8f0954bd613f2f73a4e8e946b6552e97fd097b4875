import { IncomingMessage, ServerResponse } from 'node:http';
import { Transport } from '../shared/transport.js';
import { MessageExtraInfo, JSONRPCMessage, RequestId } from '../types.js';
import { AuthInfo } from './auth/types.js';
export type StreamId = string;
export type EventId = string;
/**
 * Interface for resumability support via event storage
 */
export interface EventStore {
    /**
     * Stores an event for later retrieval
     * @param streamId ID of the stream the event belongs to
     * @param message The JSON-RPC message to store
     * @returns The generated event ID for the stored event
     */
    storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId>;
    replayEventsAfter(lastEventId: EventId, { send }: {
        send: (eventId: EventId, message: JSONRPCMessage) => Promise<void>;
    }): Promise<StreamId>;
}
/**
 * Configuration options for StreamableHTTPServerTransport
 */
export interface StreamableHTTPServerTransportOptions {
    /**
     * Function that generates a session ID for the transport.
     * The session ID SHOULD be globally unique and cryptographically secure (e.g., a securely generated UUID, a JWT, or a cryptographic hash)
     *
     * Return undefined to disable session management.
     */
    sessionIdGenerator: (() => string) | undefined;
    /**
     * A callback for session initialization events
     * This is called when the server initializes a new session.
     * Useful in cases when you need to register multiple mcp sessions
     * and need to keep track of them.
     * @param sessionId The generated session ID
     */
    onsessioninitialized?: (sessionId: string) => void | Promise<void>;
    /**
     * A callback for session close events
     * This is called when the server closes a session due to a DELETE request.
     * Useful in cases when you need to clean up resources associated with the session.
     * Note that this is different from the transport closing, if you are handling
     * HTTP requests from multiple nodes you might want to close each
     * StreamableHTTPServerTransport after a request is completed while still keeping the
     * session open/running.
     * @param sessionId The session ID that was closed
     */
    onsessionclosed?: (sessionId: string) => void | Promise<void>;
    /**
     * If true, the server will return JSON responses instead of starting an SSE stream.
     * This can be useful for simple request/response scenarios without streaming.
     * Default is false (SSE streams are preferred).
     */
    enableJsonResponse?: boolean;
    /**
     * Event store for resumability support
     * If provided, resumability will be enabled, allowing clients to reconnect and resume messages
     */
    eventStore?: EventStore;
    /**
     * List of allowed host header values for DNS rebinding protection.
     * If not specified, host validation is disabled.
     */
    allowedHosts?: string[];
    /**
     * List of allowed origin header values for DNS rebinding protection.
     * If not specified, origin validation is disabled.
     */
    allowedOrigins?: string[];
    /**
     * Enable DNS rebinding protection (requires allowedHosts and/or allowedOrigins to be configured).
     * Default is false for backwards compatibility.
     */
    enableDnsRebindingProtection?: boolean;
}
/**
 * Server transport for Streamable HTTP: this implements the MCP Streamable HTTP transport specification.
 * It supports both SSE streaming and direct HTTP responses.
 *
 * Usage example:
 *
 * ```typescript
 * // Stateful mode - server sets the session ID
 * const statefulTransport = new StreamableHTTPServerTransport({
 *   sessionIdGenerator: () => randomUUID(),
 * });
 *
 * // Stateless mode - explicitly set session ID to undefined
 * const statelessTransport = new StreamableHTTPServerTransport({
 *   sessionIdGenerator: undefined,
 * });
 *
 * // Using with pre-parsed request body
 * app.post('/mcp', (req, res) => {
 *   transport.handleRequest(req, res, req.body);
 * });
 * ```
 *
 * In stateful mode:
 * - Session ID is generated and included in response headers
 * - Session ID is always included in initialization responses
 * - Requests with invalid session IDs are rejected with 404 Not Found
 * - Non-initialization requests without a session ID are rejected with 400 Bad Request
 * - State is maintained in-memory (connections, message history)
 *
 * In stateless mode:
 * - No Session ID is included in any responses
 * - No session validation is performed
 */
export declare class StreamableHTTPServerTransport implements Transport {
    private sessionIdGenerator;
    private _started;
    private _streamMapping;
    private _requestToStreamMapping;
    private _requestResponseMap;
    private _initialized;
    private _enableJsonResponse;
    private _standaloneSseStreamId;
    private _eventStore?;
    private _onsessioninitialized?;
    private _onsessionclosed?;
    private _allowedHosts?;
    private _allowedOrigins?;
    private _enableDnsRebindingProtection;
    sessionId?: string;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
    constructor(options: StreamableHTTPServerTransportOptions);
    /**
     * Starts the transport. This is required by the Transport interface but is a no-op
     * for the Streamable HTTP transport as connections are managed per-request.
     */
    start(): Promise<void>;
    /**
     * Validates request headers for DNS rebinding protection.
     * @returns Error message if validation fails, undefined if validation passes.
     */
    private validateRequestHeaders;
    /**
     * Handles an incoming HTTP request, whether GET or POST
     */
    handleRequest(req: IncomingMessage & {
        auth?: AuthInfo;
    }, res: ServerResponse, parsedBody?: unknown): Promise<void>;
    /**
     * Handles GET requests for SSE stream
     */
    private handleGetRequest;
    /**
     * Replays events that would have been sent after the specified event ID
     * Only used when resumability is enabled
     */
    private replayEvents;
    /**
     * Writes an event to the SSE stream with proper formatting
     */
    private writeSSEEvent;
    /**
     * Handles unsupported requests (PUT, PATCH, etc.)
     */
    private handleUnsupportedRequest;
    /**
     * Handles POST requests containing JSON-RPC messages
     */
    private handlePostRequest;
    /**
     * Handles DELETE requests to terminate sessions
     */
    private handleDeleteRequest;
    /**
     * Validates session ID for non-initialization requests
     * Returns true if the session is valid, false otherwise
     */
    private validateSession;
    private validateProtocolVersion;
    close(): Promise<void>;
    send(message: JSONRPCMessage, options?: {
        relatedRequestId?: RequestId;
    }): Promise<void>;
}
//# sourceMappingURL=streamableHttp.d.ts.map