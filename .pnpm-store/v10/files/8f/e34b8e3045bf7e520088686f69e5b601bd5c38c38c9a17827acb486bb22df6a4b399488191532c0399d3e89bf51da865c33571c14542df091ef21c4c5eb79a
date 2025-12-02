import { type ConnBaseQueryParams } from '@clickhouse/client-common';
import type Http from 'http';
import type { NodeConnectionParams, RequestParams } from './node_base_connection';
import { NodeBaseConnection } from './node_base_connection';
export declare class NodeHttpsConnection extends NodeBaseConnection {
    constructor(params: NodeConnectionParams);
    protected buildRequestHeaders(params?: ConnBaseQueryParams): Http.OutgoingHttpHeaders;
    protected createClientRequest(params: RequestParams): Http.ClientRequest;
}
