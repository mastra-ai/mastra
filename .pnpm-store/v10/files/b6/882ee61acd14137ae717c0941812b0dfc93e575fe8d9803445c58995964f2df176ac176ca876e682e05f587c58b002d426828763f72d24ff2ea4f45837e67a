"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeHttpConnection = void 0;
const client_common_1 = require("@clickhouse/client-common");
const http_1 = __importDefault(require("http"));
const node_base_connection_1 = require("./node_base_connection");
class NodeHttpConnection extends node_base_connection_1.NodeBaseConnection {
    constructor(params) {
        const agent = new http_1.default.Agent({
            keepAlive: params.keep_alive.enabled,
            maxSockets: params.max_open_connections,
        });
        super(params, agent);
    }
    createClientRequest(params) {
        const headers = (0, client_common_1.withCompressionHeaders)({
            headers: params.headers,
            enable_request_compression: params.enable_request_compression,
            enable_response_compression: params.enable_response_compression,
        });
        return http_1.default.request(params.url, {
            method: params.method,
            agent: this.agent,
            timeout: this.params.request_timeout,
            signal: params.abort_signal,
            headers,
        });
    }
}
exports.NodeHttpConnection = NodeHttpConnection;
//# sourceMappingURL=node_http_connection.js.map