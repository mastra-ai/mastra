"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeCustomAgentConnection = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const node_base_connection_1 = require("./node_base_connection");
const client_common_1 = require("@clickhouse/client-common");
class NodeCustomAgentConnection extends node_base_connection_1.NodeBaseConnection {
    constructor(params) {
        if (!params.http_agent) {
            throw new Error('http_agent is required to create NodeCustomAgentConnection');
        }
        super(params, params.http_agent);
        Object.defineProperty(this, "httpRequestFn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // See https://github.com/ClickHouse/clickhouse-js/issues/352
        if (params.url.protocol.startsWith('https')) {
            this.httpRequestFn = https_1.default.request;
        }
        else {
            this.httpRequestFn = http_1.default.request;
        }
    }
    createClientRequest(params) {
        const headers = (0, client_common_1.withCompressionHeaders)({
            headers: params.headers,
            enable_request_compression: params.enable_request_compression,
            enable_response_compression: params.enable_response_compression,
        });
        return this.httpRequestFn(params.url, {
            method: params.method,
            agent: this.agent,
            timeout: this.params.request_timeout,
            signal: params.abort_signal,
            headers,
        });
    }
}
exports.NodeCustomAgentConnection = NodeCustomAgentConnection;
//# sourceMappingURL=node_custom_agent_connection.js.map