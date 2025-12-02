import type { ConnectionParams } from '@clickhouse/client-common';
import type http from 'http';
import type https from 'node:https';
import type { NodeBaseConnection, NodeConnectionParams } from './node_base_connection';
export interface CreateConnectionParams {
    connection_params: ConnectionParams;
    tls: NodeConnectionParams['tls'];
    keep_alive: NodeConnectionParams['keep_alive'];
    http_agent: http.Agent | https.Agent | undefined;
    set_basic_auth_header: boolean;
    capture_enhanced_stack_trace: boolean;
}
/** A factory for easier mocking after Node.js 22.18 */
export declare class NodeConnectionFactory {
    static create({ connection_params, tls, keep_alive, http_agent, set_basic_auth_header, capture_enhanced_stack_trace, }: CreateConnectionParams): NodeBaseConnection;
}
