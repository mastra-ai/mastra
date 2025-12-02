"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamableHTTPClientTransport = exports.StreamableHTTPError = void 0;
const types_js_1 = require("../types.js");
const auth_js_1 = require("./auth.js");
const stream_1 = require("eventsource-parser/stream");
// Default reconnection options for StreamableHTTP connections
const DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS = {
    initialReconnectionDelay: 1000,
    maxReconnectionDelay: 30000,
    reconnectionDelayGrowFactor: 1.5,
    maxRetries: 2
};
class StreamableHTTPError extends Error {
    constructor(code, message) {
        super(`Streamable HTTP error: ${message}`);
        this.code = code;
    }
}
exports.StreamableHTTPError = StreamableHTTPError;
/**
 * Client transport for Streamable HTTP: this implements the MCP Streamable HTTP transport specification.
 * It will connect to a server using HTTP POST for sending messages and HTTP GET with Server-Sent Events
 * for receiving messages.
 */
class StreamableHTTPClientTransport {
    constructor(url, opts) {
        var _a;
        this._hasCompletedAuthFlow = false; // Circuit breaker: detect auth success followed by immediate 401
        this._url = url;
        this._resourceMetadataUrl = undefined;
        this._requestInit = opts === null || opts === void 0 ? void 0 : opts.requestInit;
        this._authProvider = opts === null || opts === void 0 ? void 0 : opts.authProvider;
        this._fetch = opts === null || opts === void 0 ? void 0 : opts.fetch;
        this._sessionId = opts === null || opts === void 0 ? void 0 : opts.sessionId;
        this._reconnectionOptions = (_a = opts === null || opts === void 0 ? void 0 : opts.reconnectionOptions) !== null && _a !== void 0 ? _a : DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS;
    }
    async _authThenStart() {
        var _a;
        if (!this._authProvider) {
            throw new auth_js_1.UnauthorizedError('No auth provider');
        }
        let result;
        try {
            result = await (0, auth_js_1.auth)(this._authProvider, {
                serverUrl: this._url,
                resourceMetadataUrl: this._resourceMetadataUrl,
                fetchFn: this._fetch
            });
        }
        catch (error) {
            (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            throw error;
        }
        if (result !== 'AUTHORIZED') {
            throw new auth_js_1.UnauthorizedError();
        }
        return await this._startOrAuthSse({ resumptionToken: undefined });
    }
    async _commonHeaders() {
        var _a;
        const headers = {};
        if (this._authProvider) {
            const tokens = await this._authProvider.tokens();
            if (tokens) {
                headers['Authorization'] = `Bearer ${tokens.access_token}`;
            }
        }
        if (this._sessionId) {
            headers['mcp-session-id'] = this._sessionId;
        }
        if (this._protocolVersion) {
            headers['mcp-protocol-version'] = this._protocolVersion;
        }
        const extraHeaders = this._normalizeHeaders((_a = this._requestInit) === null || _a === void 0 ? void 0 : _a.headers);
        return new Headers({
            ...headers,
            ...extraHeaders
        });
    }
    async _startOrAuthSse(options) {
        var _a, _b, _c;
        const { resumptionToken } = options;
        try {
            // Try to open an initial SSE stream with GET to listen for server messages
            // This is optional according to the spec - server may not support it
            const headers = await this._commonHeaders();
            headers.set('Accept', 'text/event-stream');
            // Include Last-Event-ID header for resumable streams if provided
            if (resumptionToken) {
                headers.set('last-event-id', resumptionToken);
            }
            const response = await ((_a = this._fetch) !== null && _a !== void 0 ? _a : fetch)(this._url, {
                method: 'GET',
                headers,
                signal: (_b = this._abortController) === null || _b === void 0 ? void 0 : _b.signal
            });
            if (!response.ok) {
                if (response.status === 401 && this._authProvider) {
                    // Need to authenticate
                    return await this._authThenStart();
                }
                // 405 indicates that the server does not offer an SSE stream at GET endpoint
                // This is an expected case that should not trigger an error
                if (response.status === 405) {
                    return;
                }
                throw new StreamableHTTPError(response.status, `Failed to open SSE stream: ${response.statusText}`);
            }
            this._handleSseStream(response.body, options, true);
        }
        catch (error) {
            (_c = this.onerror) === null || _c === void 0 ? void 0 : _c.call(this, error);
            throw error;
        }
    }
    /**
     * Calculates the next reconnection delay using  backoff algorithm
     *
     * @param attempt Current reconnection attempt count for the specific stream
     * @returns Time to wait in milliseconds before next reconnection attempt
     */
    _getNextReconnectionDelay(attempt) {
        // Access default values directly, ensuring they're never undefined
        const initialDelay = this._reconnectionOptions.initialReconnectionDelay;
        const growFactor = this._reconnectionOptions.reconnectionDelayGrowFactor;
        const maxDelay = this._reconnectionOptions.maxReconnectionDelay;
        // Cap at maximum delay
        return Math.min(initialDelay * Math.pow(growFactor, attempt), maxDelay);
    }
    _normalizeHeaders(headers) {
        if (!headers)
            return {};
        if (headers instanceof Headers) {
            return Object.fromEntries(headers.entries());
        }
        if (Array.isArray(headers)) {
            return Object.fromEntries(headers);
        }
        return { ...headers };
    }
    /**
     * Schedule a reconnection attempt with exponential backoff
     *
     * @param lastEventId The ID of the last received event for resumability
     * @param attemptCount Current reconnection attempt count for this specific stream
     */
    _scheduleReconnection(options, attemptCount = 0) {
        var _a;
        // Use provided options or default options
        const maxRetries = this._reconnectionOptions.maxRetries;
        // Check if we've exceeded maximum retry attempts
        if (maxRetries > 0 && attemptCount >= maxRetries) {
            (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, new Error(`Maximum reconnection attempts (${maxRetries}) exceeded.`));
            return;
        }
        // Calculate next delay based on current attempt count
        const delay = this._getNextReconnectionDelay(attemptCount);
        // Schedule the reconnection
        setTimeout(() => {
            // Use the last event ID to resume where we left off
            this._startOrAuthSse(options).catch(error => {
                var _a;
                (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, new Error(`Failed to reconnect SSE stream: ${error instanceof Error ? error.message : String(error)}`));
                // Schedule another attempt if this one failed, incrementing the attempt counter
                this._scheduleReconnection(options, attemptCount + 1);
            });
        }, delay);
    }
    _handleSseStream(stream, options, isReconnectable) {
        if (!stream) {
            return;
        }
        const { onresumptiontoken, replayMessageId } = options;
        let lastEventId;
        const processStream = async () => {
            var _a, _b, _c, _d;
            // this is the closest we can get to trying to catch network errors
            // if something happens reader will throw
            try {
                // Create a pipeline: binary stream -> text decoder -> SSE parser
                const reader = stream.pipeThrough(new TextDecoderStream()).pipeThrough(new stream_1.EventSourceParserStream()).getReader();
                while (true) {
                    const { value: event, done } = await reader.read();
                    if (done) {
                        break;
                    }
                    // Update last event ID if provided
                    if (event.id) {
                        lastEventId = event.id;
                        onresumptiontoken === null || onresumptiontoken === void 0 ? void 0 : onresumptiontoken(event.id);
                    }
                    if (!event.event || event.event === 'message') {
                        try {
                            const message = types_js_1.JSONRPCMessageSchema.parse(JSON.parse(event.data));
                            if (replayMessageId !== undefined && (0, types_js_1.isJSONRPCResponse)(message)) {
                                message.id = replayMessageId;
                            }
                            (_a = this.onmessage) === null || _a === void 0 ? void 0 : _a.call(this, message);
                        }
                        catch (error) {
                            (_b = this.onerror) === null || _b === void 0 ? void 0 : _b.call(this, error);
                        }
                    }
                }
            }
            catch (error) {
                // Handle stream errors - likely a network disconnect
                (_c = this.onerror) === null || _c === void 0 ? void 0 : _c.call(this, new Error(`SSE stream disconnected: ${error}`));
                // Attempt to reconnect if the stream disconnects unexpectedly and we aren't closing
                if (isReconnectable && this._abortController && !this._abortController.signal.aborted) {
                    // Use the exponential backoff reconnection strategy
                    try {
                        this._scheduleReconnection({
                            resumptionToken: lastEventId,
                            onresumptiontoken,
                            replayMessageId
                        }, 0);
                    }
                    catch (error) {
                        (_d = this.onerror) === null || _d === void 0 ? void 0 : _d.call(this, new Error(`Failed to reconnect: ${error instanceof Error ? error.message : String(error)}`));
                    }
                }
            }
        };
        processStream();
    }
    async start() {
        if (this._abortController) {
            throw new Error('StreamableHTTPClientTransport already started! If using Client class, note that connect() calls start() automatically.');
        }
        this._abortController = new AbortController();
    }
    /**
     * Call this method after the user has finished authorizing via their user agent and is redirected back to the MCP client application. This will exchange the authorization code for an access token, enabling the next connection attempt to successfully auth.
     */
    async finishAuth(authorizationCode) {
        if (!this._authProvider) {
            throw new auth_js_1.UnauthorizedError('No auth provider');
        }
        const result = await (0, auth_js_1.auth)(this._authProvider, {
            serverUrl: this._url,
            authorizationCode,
            resourceMetadataUrl: this._resourceMetadataUrl,
            fetchFn: this._fetch
        });
        if (result !== 'AUTHORIZED') {
            throw new auth_js_1.UnauthorizedError('Failed to authorize');
        }
    }
    async close() {
        var _a, _b;
        // Abort any pending requests
        (_a = this._abortController) === null || _a === void 0 ? void 0 : _a.abort();
        (_b = this.onclose) === null || _b === void 0 ? void 0 : _b.call(this);
    }
    async send(message, options) {
        var _a, _b, _c, _d;
        try {
            const { resumptionToken, onresumptiontoken } = options || {};
            if (resumptionToken) {
                // If we have at last event ID, we need to reconnect the SSE stream
                this._startOrAuthSse({ resumptionToken, replayMessageId: (0, types_js_1.isJSONRPCRequest)(message) ? message.id : undefined }).catch(err => { var _a; return (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, err); });
                return;
            }
            const headers = await this._commonHeaders();
            headers.set('content-type', 'application/json');
            headers.set('accept', 'application/json, text/event-stream');
            const init = {
                ...this._requestInit,
                method: 'POST',
                headers,
                body: JSON.stringify(message),
                signal: (_a = this._abortController) === null || _a === void 0 ? void 0 : _a.signal
            };
            const response = await ((_b = this._fetch) !== null && _b !== void 0 ? _b : fetch)(this._url, init);
            // Handle session ID received during initialization
            const sessionId = response.headers.get('mcp-session-id');
            if (sessionId) {
                this._sessionId = sessionId;
            }
            if (!response.ok) {
                if (response.status === 401 && this._authProvider) {
                    // Prevent infinite recursion when server returns 401 after successful auth
                    if (this._hasCompletedAuthFlow) {
                        throw new StreamableHTTPError(401, 'Server returned 401 after successful authentication');
                    }
                    this._resourceMetadataUrl = (0, auth_js_1.extractResourceMetadataUrl)(response);
                    const result = await (0, auth_js_1.auth)(this._authProvider, {
                        serverUrl: this._url,
                        resourceMetadataUrl: this._resourceMetadataUrl,
                        fetchFn: this._fetch
                    });
                    if (result !== 'AUTHORIZED') {
                        throw new auth_js_1.UnauthorizedError();
                    }
                    // Mark that we completed auth flow
                    this._hasCompletedAuthFlow = true;
                    // Purposely _not_ awaited, so we don't call onerror twice
                    return this.send(message);
                }
                const text = await response.text().catch(() => null);
                throw new Error(`Error POSTing to endpoint (HTTP ${response.status}): ${text}`);
            }
            // Reset auth loop flag on successful response
            this._hasCompletedAuthFlow = false;
            // If the response is 202 Accepted, there's no body to process
            if (response.status === 202) {
                // if the accepted notification is initialized, we start the SSE stream
                // if it's supported by the server
                if ((0, types_js_1.isInitializedNotification)(message)) {
                    // Start without a lastEventId since this is a fresh connection
                    this._startOrAuthSse({ resumptionToken: undefined }).catch(err => { var _a; return (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, err); });
                }
                return;
            }
            // Get original message(s) for detecting request IDs
            const messages = Array.isArray(message) ? message : [message];
            const hasRequests = messages.filter(msg => 'method' in msg && 'id' in msg && msg.id !== undefined).length > 0;
            // Check the response type
            const contentType = response.headers.get('content-type');
            if (hasRequests) {
                if (contentType === null || contentType === void 0 ? void 0 : contentType.includes('text/event-stream')) {
                    // Handle SSE stream responses for requests
                    // We use the same handler as standalone streams, which now supports
                    // reconnection with the last event ID
                    this._handleSseStream(response.body, { onresumptiontoken }, false);
                }
                else if (contentType === null || contentType === void 0 ? void 0 : contentType.includes('application/json')) {
                    // For non-streaming servers, we might get direct JSON responses
                    const data = await response.json();
                    const responseMessages = Array.isArray(data)
                        ? data.map(msg => types_js_1.JSONRPCMessageSchema.parse(msg))
                        : [types_js_1.JSONRPCMessageSchema.parse(data)];
                    for (const msg of responseMessages) {
                        (_c = this.onmessage) === null || _c === void 0 ? void 0 : _c.call(this, msg);
                    }
                }
                else {
                    throw new StreamableHTTPError(-1, `Unexpected content type: ${contentType}`);
                }
            }
        }
        catch (error) {
            (_d = this.onerror) === null || _d === void 0 ? void 0 : _d.call(this, error);
            throw error;
        }
    }
    get sessionId() {
        return this._sessionId;
    }
    /**
     * Terminates the current session by sending a DELETE request to the server.
     *
     * Clients that no longer need a particular session
     * (e.g., because the user is leaving the client application) SHOULD send an
     * HTTP DELETE to the MCP endpoint with the Mcp-Session-Id header to explicitly
     * terminate the session.
     *
     * The server MAY respond with HTTP 405 Method Not Allowed, indicating that
     * the server does not allow clients to terminate sessions.
     */
    async terminateSession() {
        var _a, _b, _c;
        if (!this._sessionId) {
            return; // No session to terminate
        }
        try {
            const headers = await this._commonHeaders();
            const init = {
                ...this._requestInit,
                method: 'DELETE',
                headers,
                signal: (_a = this._abortController) === null || _a === void 0 ? void 0 : _a.signal
            };
            const response = await ((_b = this._fetch) !== null && _b !== void 0 ? _b : fetch)(this._url, init);
            // We specifically handle 405 as a valid response according to the spec,
            // meaning the server does not support explicit session termination
            if (!response.ok && response.status !== 405) {
                throw new StreamableHTTPError(response.status, `Failed to terminate session: ${response.statusText}`);
            }
            this._sessionId = undefined;
        }
        catch (error) {
            (_c = this.onerror) === null || _c === void 0 ? void 0 : _c.call(this, error);
            throw error;
        }
    }
    setProtocolVersion(version) {
        this._protocolVersion = version;
    }
    get protocolVersion() {
        return this._protocolVersion;
    }
}
exports.StreamableHTTPClientTransport = StreamableHTTPClientTransport;
//# sourceMappingURL=streamableHttp.js.map