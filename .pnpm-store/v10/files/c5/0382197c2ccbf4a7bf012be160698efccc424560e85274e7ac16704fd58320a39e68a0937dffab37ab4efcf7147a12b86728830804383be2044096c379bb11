var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { AbstractClient, noop } from "./AbstractClient";
import { CONNECTION_STATE, SOCKET_STATES } from "../lib/constants";
import { isBun } from "../lib/runtime";
/**
 * Represents an error that occurred in a WebSocket-like connection.
 * @property {any} error - The underlying error object.
 * @property {string} message - A human-readable error message.
 * @property {string} type - The type of the error.
 */
// interface WebSocketLikeError {
//   error: any;
//   message: string;
//   type: string;
// }
/**
 * Indicates whether a native WebSocket implementation is available in the current environment.
 */
const NATIVE_WEBSOCKET_AVAILABLE = typeof WebSocket !== "undefined";
/**
 * Represents an abstract live client that extends the AbstractClient class.
 * The AbstractLiveClient class provides functionality for connecting, reconnecting, and disconnecting a WebSocket connection, as well as sending data over the connection.
 * Subclasses of this class are responsible for setting up the connection event handlers.
 *
 * @abstract
 */
export class AbstractLiveClient extends AbstractClient {
    constructor(options) {
        super(options);
        this.conn = null;
        this.sendBuffer = [];
        /**
         * Reconnects the socket using new or existing transcription options.
         *
         * @param options - The transcription options to use when reconnecting the socket.
         */
        this.reconnect = noop;
        const { key, websocket: { options: websocketOptions, client }, } = this.namespaceOptions;
        if (this.proxy) {
            this.baseUrl = websocketOptions.proxy.url;
        }
        else {
            this.baseUrl = websocketOptions.url;
        }
        if (client) {
            this.transport = client;
        }
        else {
            this.transport = null;
        }
        if (websocketOptions._nodeOnlyHeaders) {
            this.headers = websocketOptions._nodeOnlyHeaders;
        }
        else {
            this.headers = {};
        }
        if (!("Authorization" in this.headers)) {
            this.headers["Authorization"] = `Token ${key}`; // Add default token
        }
    }
    /**
     * Connects the socket, unless already connected.
     *
     * @protected Can only be called from within the class.
     */
    connect(transcriptionOptions, endpoint) {
        if (this.conn) {
            return;
        }
        this.reconnect = (options = transcriptionOptions) => {
            this.connect(options, endpoint);
        };
        const requestUrl = this.getRequestUrl(endpoint, {}, transcriptionOptions);
        /**
         * Custom websocket transport
         */
        if (this.transport) {
            this.conn = new this.transport(requestUrl, undefined, {
                headers: this.headers,
            });
            return;
        }
        /**
         * @summary Bun websocket transport has a bug where it's native WebSocket implementation messes up the headers
         * @summary This is a workaround to use the WS package for the websocket connection instead of the native Bun WebSocket
         * @summary you can track the issue here
         * @link https://github.com/oven-sh/bun/issues/4529
         */
        if (isBun()) {
            import("ws").then(({ default: WS }) => {
                this.conn = new WS(requestUrl, {
                    headers: this.headers,
                });
                console.log(`Using WS package`);
                this.setupConnection();
            });
            return;
        }
        /**
         * Native websocket transport (browser)
         */
        if (NATIVE_WEBSOCKET_AVAILABLE) {
            this.conn = new WebSocket(requestUrl, ["token", this.namespaceOptions.key]);
            this.setupConnection();
            return;
        }
        /**
         * Dummy websocket
         */
        this.conn = new WSWebSocketDummy(requestUrl, undefined, {
            close: () => {
                this.conn = null;
            },
        });
        /**
         * WS package for node environment
         */
        import("ws").then(({ default: WS }) => {
            this.conn = new WS(requestUrl, undefined, {
                headers: this.headers,
            });
            this.setupConnection();
        });
    }
    /**
     * Disconnects the socket from the client.
     *
     * @param code A numeric status code to send on disconnect.
     * @param reason A custom reason for the disconnect.
     */
    disconnect(code, reason) {
        if (this.conn) {
            this.conn.onclose = function () { }; // noop
            if (code) {
                this.conn.close(code, reason !== null && reason !== void 0 ? reason : "");
            }
            else {
                this.conn.close();
            }
            this.conn = null;
        }
    }
    /**
     * Returns the current connection state of the WebSocket connection.
     *
     * @returns The current connection state of the WebSocket connection.
     */
    connectionState() {
        switch (this.conn && this.conn.readyState) {
            case SOCKET_STATES.connecting:
                return CONNECTION_STATE.Connecting;
            case SOCKET_STATES.open:
                return CONNECTION_STATE.Open;
            case SOCKET_STATES.closing:
                return CONNECTION_STATE.Closing;
            default:
                return CONNECTION_STATE.Closed;
        }
    }
    /**
     * Returns the current ready state of the WebSocket connection.
     *
     * @returns The current ready state of the WebSocket connection.
     */
    getReadyState() {
        var _a, _b;
        return (_b = (_a = this.conn) === null || _a === void 0 ? void 0 : _a.readyState) !== null && _b !== void 0 ? _b : SOCKET_STATES.closed;
    }
    /**
     * Returns `true` is the connection is open.
     */
    isConnected() {
        return this.connectionState() === CONNECTION_STATE.Open;
    }
    /**
     * Sends data to the Deepgram API via websocket connection
     * @param data Audio data to send to Deepgram
     *
     * Conforms to RFC #146 for Node.js - does not send an empty byte.
     * @see https://github.com/deepgram/deepgram-python-sdk/issues/146
     */
    send(data) {
        const callback = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (data instanceof Blob) {
                if (data.size === 0) {
                    this.log("warn", "skipping `send` for zero-byte blob", data);
                    return;
                }
                data = yield data.arrayBuffer();
            }
            if (typeof data !== "string") {
                if (!(data === null || data === void 0 ? void 0 : data.byteLength)) {
                    this.log("warn", "skipping `send` for zero-byte payload", data);
                    return;
                }
            }
            (_a = this.conn) === null || _a === void 0 ? void 0 : _a.send(data);
        });
        if (this.isConnected()) {
            callback();
        }
        else {
            this.sendBuffer.push(callback);
        }
    }
    /**
     * Determines whether the current instance should proxy requests.
     * @returns {boolean} true if the current instance should proxy requests; otherwise, false
     */
    get proxy() {
        var _a;
        return this.key === "proxy" && !!((_a = this.namespaceOptions.websocket.options.proxy) === null || _a === void 0 ? void 0 : _a.url);
    }
}
class WSWebSocketDummy {
    constructor(address, _protocols, options) {
        this.binaryType = "arraybuffer";
        this.onclose = () => { };
        this.onerror = () => { };
        this.onmessage = () => { };
        this.onopen = () => { };
        this.readyState = SOCKET_STATES.connecting;
        this.send = () => { };
        this.url = null;
        this.url = address.toString();
        this.close = options.close;
    }
}
export { AbstractLiveClient as AbstractWsClient };
//# sourceMappingURL=AbstractLiveClient.js.map