"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeHttpsConnection = void 0;
const client_common_1 = require("@clickhouse/client-common");
const https_1 = __importDefault(require("https"));
const node_base_connection_1 = require("./node_base_connection");
class NodeHttpsConnection extends node_base_connection_1.NodeBaseConnection {
    constructor(params) {
        const agent = new https_1.default.Agent({
            keepAlive: params.keep_alive.enabled,
            maxSockets: params.max_open_connections,
            ca: params.tls?.ca_cert,
            key: params.tls?.type === 'Mutual' ? params.tls.key : undefined,
            cert: params.tls?.type === 'Mutual' ? params.tls.cert : undefined,
        });
        super(params, agent);
    }
    buildRequestHeaders(params) {
        if (this.params.tls !== undefined) {
            if (this.params.auth.type === 'JWT') {
                throw new Error('JWT auth is not supported with HTTPS connection using custom certificates');
            }
            let headers;
            if ((0, client_common_1.isCredentialsAuth)(params?.auth)) {
                headers = {
                    ...this.defaultHeadersWithOverride(params),
                    'X-ClickHouse-User': params.auth.username,
                    'X-ClickHouse-Key': params.auth.password,
                };
            }
            else {
                headers = {
                    ...this.defaultHeadersWithOverride(params),
                    'X-ClickHouse-User': this.params.auth.username,
                    'X-ClickHouse-Key': this.params.auth.password,
                };
            }
            const tlsType = this.params.tls.type;
            switch (tlsType) {
                case 'Basic':
                    return headers;
                case 'Mutual':
                    return {
                        ...headers,
                        'X-ClickHouse-SSL-Certificate-Auth': 'on',
                    };
                default:
                    throw new Error(`Unknown TLS type: ${tlsType}`);
            }
        }
        return super.buildRequestHeaders(params);
    }
    createClientRequest(params) {
        const headers = (0, client_common_1.withCompressionHeaders)({
            headers: params.headers,
            enable_request_compression: params.enable_request_compression,
            enable_response_compression: params.enable_response_compression,
        });
        return https_1.default.request(params.url, {
            method: params.method,
            agent: this.agent,
            timeout: this.params.request_timeout,
            signal: params.abort_signal,
            headers,
        });
    }
}
exports.NodeHttpsConnection = NodeHttpsConnection;
//# sourceMappingURL=node_https_connection.js.map