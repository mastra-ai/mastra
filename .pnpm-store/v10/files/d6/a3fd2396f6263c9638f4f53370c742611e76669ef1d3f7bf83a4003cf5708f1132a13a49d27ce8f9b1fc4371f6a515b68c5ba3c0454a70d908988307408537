import Http from 'http';
import type { NodeConnectionParams, RequestParams } from './node_base_connection';
import { NodeBaseConnection } from './node_base_connection';
export declare class NodeCustomAgentConnection extends NodeBaseConnection {
    private readonly httpRequestFn;
    constructor(params: NodeConnectionParams);
    protected createClientRequest(params: RequestParams): Http.ClientRequest;
}
