"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSEClientTransport = exports.SseError = void 0;
const eventsource_1 = require("eventsource");
const types_js_1 = require("../types.js");
const auth_js_1 = require("./auth.js");
class SseError extends Error {
    constructor(code, message, event) {
        super(`SSE error: ${message}`);
        this.code = code;
        this.event = event;
    }
}
exports.SseError = SseError;
/**
 * Client transport for SSE: this will connect to a server using Server-Sent Events for receiving
 * messages and make separate POST requests for sending messages.
 */
class SSEClientTransport {
    constructor(url, opts) {
        this._url = url;
        this._resourceMetadataUrl = undefined;
        this._eventSourceInit = opts === null || opts === void 0 ? void 0 : opts.eventSourceInit;
        this._requestInit = opts === null || opts === void 0 ? void 0 : opts.requestInit;
        this._authProvider = opts === null || opts === void 0 ? void 0 : opts.authProvider;
        this._fetch = opts === null || opts === void 0 ? void 0 : opts.fetch;
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
        return await this._startOrAuth();
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
        if (this._protocolVersion) {
            headers['mcp-protocol-version'] = this._protocolVersion;
        }
        return new Headers({ ...headers, ...(_a = this._requestInit) === null || _a === void 0 ? void 0 : _a.headers });
    }
    _startOrAuth() {
        var _a, _b, _c;
        const fetchImpl = ((_c = (_b = (_a = this === null || this === void 0 ? void 0 : this._eventSourceInit) === null || _a === void 0 ? void 0 : _a.fetch) !== null && _b !== void 0 ? _b : this._fetch) !== null && _c !== void 0 ? _c : fetch);
        return new Promise((resolve, reject) => {
            this._eventSource = new eventsource_1.EventSource(this._url.href, {
                ...this._eventSourceInit,
                fetch: async (url, init) => {
                    const headers = await this._commonHeaders();
                    headers.set('Accept', 'text/event-stream');
                    const response = await fetchImpl(url, {
                        ...init,
                        headers
                    });
                    if (response.status === 401 && response.headers.has('www-authenticate')) {
                        this._resourceMetadataUrl = (0, auth_js_1.extractResourceMetadataUrl)(response);
                    }
                    return response;
                }
            });
            this._abortController = new AbortController();
            this._eventSource.onerror = event => {
                var _a;
                if (event.code === 401 && this._authProvider) {
                    this._authThenStart().then(resolve, reject);
                    return;
                }
                const error = new SseError(event.code, event.message, event);
                reject(error);
                (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            };
            this._eventSource.onopen = () => {
                // The connection is open, but we need to wait for the endpoint to be received.
            };
            this._eventSource.addEventListener('endpoint', (event) => {
                var _a;
                const messageEvent = event;
                try {
                    this._endpoint = new URL(messageEvent.data, this._url);
                    if (this._endpoint.origin !== this._url.origin) {
                        throw new Error(`Endpoint origin does not match connection origin: ${this._endpoint.origin}`);
                    }
                }
                catch (error) {
                    reject(error);
                    (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
                    void this.close();
                    return;
                }
                resolve();
            });
            this._eventSource.onmessage = (event) => {
                var _a, _b;
                const messageEvent = event;
                let message;
                try {
                    message = types_js_1.JSONRPCMessageSchema.parse(JSON.parse(messageEvent.data));
                }
                catch (error) {
                    (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
                    return;
                }
                (_b = this.onmessage) === null || _b === void 0 ? void 0 : _b.call(this, message);
            };
        });
    }
    async start() {
        if (this._eventSource) {
            throw new Error('SSEClientTransport already started! If using Client class, note that connect() calls start() automatically.');
        }
        return await this._startOrAuth();
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
        var _a, _b, _c;
        (_a = this._abortController) === null || _a === void 0 ? void 0 : _a.abort();
        (_b = this._eventSource) === null || _b === void 0 ? void 0 : _b.close();
        (_c = this.onclose) === null || _c === void 0 ? void 0 : _c.call(this);
    }
    async send(message) {
        var _a, _b, _c;
        if (!this._endpoint) {
            throw new Error('Not connected');
        }
        try {
            const headers = await this._commonHeaders();
            headers.set('content-type', 'application/json');
            const init = {
                ...this._requestInit,
                method: 'POST',
                headers,
                body: JSON.stringify(message),
                signal: (_a = this._abortController) === null || _a === void 0 ? void 0 : _a.signal
            };
            const response = await ((_b = this._fetch) !== null && _b !== void 0 ? _b : fetch)(this._endpoint, init);
            if (!response.ok) {
                if (response.status === 401 && this._authProvider) {
                    this._resourceMetadataUrl = (0, auth_js_1.extractResourceMetadataUrl)(response);
                    const result = await (0, auth_js_1.auth)(this._authProvider, {
                        serverUrl: this._url,
                        resourceMetadataUrl: this._resourceMetadataUrl,
                        fetchFn: this._fetch
                    });
                    if (result !== 'AUTHORIZED') {
                        throw new auth_js_1.UnauthorizedError();
                    }
                    // Purposely _not_ awaited, so we don't call onerror twice
                    return this.send(message);
                }
                const text = await response.text().catch(() => null);
                throw new Error(`Error POSTing to endpoint (HTTP ${response.status}): ${text}`);
            }
        }
        catch (error) {
            (_c = this.onerror) === null || _c === void 0 ? void 0 : _c.call(this, error);
            throw error;
        }
    }
    setProtocolVersion(version) {
        this._protocolVersion = version;
    }
}
exports.SSEClientTransport = SSEClientTransport;
//# sourceMappingURL=sse.js.map