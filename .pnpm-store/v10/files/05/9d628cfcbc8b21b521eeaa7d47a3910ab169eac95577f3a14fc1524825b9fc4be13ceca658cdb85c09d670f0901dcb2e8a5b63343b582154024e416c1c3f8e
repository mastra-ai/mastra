"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClientTransport = void 0;
const types_js_1 = require("../types.js");
const SUBPROTOCOL = 'mcp';
/**
 * Client transport for WebSocket: this will connect to a server over the WebSocket protocol.
 */
class WebSocketClientTransport {
    constructor(url) {
        this._url = url;
    }
    start() {
        if (this._socket) {
            throw new Error('WebSocketClientTransport already started! If using Client class, note that connect() calls start() automatically.');
        }
        return new Promise((resolve, reject) => {
            this._socket = new WebSocket(this._url, SUBPROTOCOL);
            this._socket.onerror = event => {
                var _a;
                const error = 'error' in event ? event.error : new Error(`WebSocket error: ${JSON.stringify(event)}`);
                reject(error);
                (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            };
            this._socket.onopen = () => {
                resolve();
            };
            this._socket.onclose = () => {
                var _a;
                (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
            };
            this._socket.onmessage = (event) => {
                var _a, _b;
                let message;
                try {
                    message = types_js_1.JSONRPCMessageSchema.parse(JSON.parse(event.data));
                }
                catch (error) {
                    (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
                    return;
                }
                (_b = this.onmessage) === null || _b === void 0 ? void 0 : _b.call(this, message);
            };
        });
    }
    async close() {
        var _a;
        (_a = this._socket) === null || _a === void 0 ? void 0 : _a.close();
    }
    send(message) {
        return new Promise((resolve, reject) => {
            var _a;
            if (!this._socket) {
                reject(new Error('Not connected'));
                return;
            }
            (_a = this._socket) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(message));
            resolve();
        });
    }
}
exports.WebSocketClientTransport = WebSocketClientTransport;
//# sourceMappingURL=websocket.js.map