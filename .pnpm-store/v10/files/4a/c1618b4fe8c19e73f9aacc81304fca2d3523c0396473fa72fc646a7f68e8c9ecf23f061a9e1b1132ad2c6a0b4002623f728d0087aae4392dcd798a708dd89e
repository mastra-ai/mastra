"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeConfigImpl = void 0;
const client_common_1 = require("@clickhouse/client-common");
const connection_1 = require("./connection");
const result_set_1 = require("./result_set");
const utils_1 = require("./utils");
exports.NodeConfigImpl = {
    handle_specific_url_params: (config, url) => {
        const nodeConfig = { ...config };
        const unknownParams = new Set();
        const handledParams = new Set();
        const urlSearchParamsKeys = [...url.searchParams.keys()];
        if (urlSearchParamsKeys.length > 0) {
            urlSearchParamsKeys.forEach((key) => {
                const value = url.searchParams.get(key);
                switch (key) {
                    case 'keep_alive_idle_socket_ttl':
                        if (nodeConfig.keep_alive === undefined) {
                            nodeConfig.keep_alive = {};
                        }
                        nodeConfig.keep_alive.idle_socket_ttl = (0, client_common_1.numberConfigURLValue)({
                            key,
                            value,
                            min: 0,
                        });
                        handledParams.add(key);
                        break;
                    default:
                        unknownParams.add(key);
                }
            });
        }
        return {
            config: nodeConfig,
            unknown_params: unknownParams,
            handled_params: handledParams,
        };
    },
    make_connection: (nodeConfig, params) => {
        let tls = undefined;
        if (nodeConfig.tls !== undefined) {
            if ('cert' in nodeConfig.tls && 'key' in nodeConfig.tls) {
                tls = {
                    type: 'Mutual',
                    ...nodeConfig.tls,
                };
            }
            else {
                tls = {
                    type: 'Basic',
                    ...nodeConfig.tls,
                };
            }
        }
        // normally, it should be already set after processing the config
        const keep_alive = {
            enabled: nodeConfig?.keep_alive?.enabled ?? true,
            idle_socket_ttl: nodeConfig?.keep_alive?.idle_socket_ttl ?? 2500,
        };
        return connection_1.NodeConnectionFactory.create({
            connection_params: params,
            set_basic_auth_header: nodeConfig.set_basic_auth_header ?? true,
            capture_enhanced_stack_trace: nodeConfig.capture_enhanced_stack_trace ?? false,
            http_agent: nodeConfig.http_agent,
            keep_alive,
            tls,
        });
    },
    values_encoder: new utils_1.NodeValuesEncoder(),
    make_result_set: ((stream, format, query_id, log_error, response_headers) => result_set_1.ResultSet.instance({
        stream,
        format,
        query_id,
        log_error,
        response_headers,
    })),
};
//# sourceMappingURL=config.js.map