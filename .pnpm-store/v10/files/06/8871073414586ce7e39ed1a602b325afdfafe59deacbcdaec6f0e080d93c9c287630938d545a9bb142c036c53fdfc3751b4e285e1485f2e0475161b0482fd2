"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeClickHouseClient = void 0;
exports.createClient = createClient;
const client_common_1 = require("@clickhouse/client-common");
const config_1 = require("./config");
class NodeClickHouseClient extends client_common_1.ClickHouseClient {
    /** See {@link ClickHouseClient.query}. */
    query(params) {
        return super.query(params);
    }
}
exports.NodeClickHouseClient = NodeClickHouseClient;
function createClient(config) {
    return new client_common_1.ClickHouseClient({
        impl: config_1.NodeConfigImpl,
        ...(config || {}),
    });
}
//# sourceMappingURL=client.js.map