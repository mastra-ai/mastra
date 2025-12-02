"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractWsClient = exports.AbstractLiveClient = void 0;
const AbstractClient_1 = require("./AbstractClient");
const constants_1 = require("../lib/constants");
const runtime_1 = require("../lib/runtime");
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
class AbstractLiveClient extends AbstractClient_1.AbstractClient {
    constructor(options) {
        super(options);
        this.conn = null;
        this.sendBuffer = [];
        /**
         * Reconnects the socket using new or existing transcription options.
         *
         * @param options - The transcription options to use when reconnecting the socket.
         */
        this.reconnect = AbstractClient_1.noop;
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
        if ((0, runtime_1.isBun)()) {
            Promise.resolve().then(() => __importStar(require("ws"))).then(({ default: WS }) => {
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
        Promise.resolve().then(() => __importStar(require("ws"))).then(({ default: WS }) => {
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
            case constants_1.SOCKET_STATES.connecting:
                return constants_1.CONNECTION_STATE.Connecting;
            case constants_1.SOCKET_STATES.open:
                return constants_1.CONNECTION_STATE.Open;
            case constants_1.SOCKET_STATES.closing:
                return constants_1.CONNECTION_STATE.Closing;
            default:
                return constants_1.CONNECTION_STATE.Closed;
        }
    }
    /**
     * Returns the current ready state of the WebSocket connection.
     *
     * @returns The current ready state of the WebSocket connection.
     */
    getReadyState() {
        var _a, _b;
        return (_b = (_a = this.conn) === null || _a === void 0 ? void 0 : _a.readyState) !== null && _b !== void 0 ? _b : constants_1.SOCKET_STATES.closed;
    }
    /**
     * Returns `true` is the connection is open.
     */
    isConnected() {
        return this.connectionState() === constants_1.CONNECTION_STATE.Open;
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
exports.AbstractLiveClient = AbstractLiveClient;
exports.AbstractWsClient = AbstractLiveClient;
class WSWebSocketDummy {
    constructor(address, _protocols, options) {
        this.binaryType = "arraybuffer";
        this.onclose = () => { };
        this.onerror = () => { };
        this.onmessage = () => { };
        this.onopen = () => { };
        this.readyState = constants_1.SOCKET_STATES.connecting;
        this.send = () => { };
        this.url = null;
        this.url = address.toString();
        this.close = options.close;
    }
}
//# sourceMappingURL=AbstractLiveClient.js.map