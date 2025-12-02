"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeConnectionFactory = void 0;
const node_custom_agent_connection_1 = require("./node_custom_agent_connection");
const node_http_connection_1 = require("./node_http_connection");
const node_https_connection_1 = require("./node_https_connection");
/** A factory for easier mocking after Node.js 22.18 */
class NodeConnectionFactory {
    static create({ connection_params, tls, keep_alive, http_agent, set_basic_auth_header, capture_enhanced_stack_trace, }) {
        if (http_agent !== undefined) {
            return new node_custom_agent_connection_1.NodeCustomAgentConnection({
                ...connection_params,
                set_basic_auth_header,
                capture_enhanced_stack_trace,
                keep_alive, // only used to enforce proper KeepAlive headers
                http_agent,
            });
        }
        switch (connection_params.url.protocol) {
            case 'http:':
                return new node_http_connection_1.NodeHttpConnection({
                    ...connection_params,
                    set_basic_auth_header,
                    capture_enhanced_stack_trace,
                    keep_alive,
                });
            case 'https:':
                return new node_https_connection_1.NodeHttpsConnection({
                    ...connection_params,
                    set_basic_auth_header,
                    capture_enhanced_stack_trace,
                    keep_alive,
                    tls,
                });
            default:
                throw new Error('Only HTTP and HTTPS protocols are supported');
        }
    }
}
exports.NodeConnectionFactory = NodeConnectionFactory;
//# sourceMappingURL=create_connection.js.map