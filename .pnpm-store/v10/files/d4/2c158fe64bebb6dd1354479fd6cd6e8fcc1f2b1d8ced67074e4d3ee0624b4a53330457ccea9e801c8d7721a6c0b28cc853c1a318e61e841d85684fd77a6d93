import type { ConnBaseQueryParams, ConnCommandResult, Connection, ConnectionParams, ConnExecParams, ConnExecResult, ConnInsertParams, ConnInsertResult, ConnPingResult, ConnQueryResult } from '@clickhouse/client-common';
import { type ConnPingParams } from '@clickhouse/client-common';
import type Http from 'http';
import type Https from 'node:https';
import Stream from 'stream';
export type NodeConnectionParams = ConnectionParams & {
    tls?: TLSParams;
    http_agent?: Http.Agent | Https.Agent;
    set_basic_auth_header: boolean;
    capture_enhanced_stack_trace: boolean;
    keep_alive: {
        enabled: boolean;
        idle_socket_ttl: number;
    };
};
export type TLSParams = {
    ca_cert: Buffer;
    type: 'Basic';
} | {
    ca_cert: Buffer;
    cert: Buffer;
    key: Buffer;
    type: 'Mutual';
};
export interface RequestParams {
    method: 'GET' | 'POST';
    url: URL;
    headers: Http.OutgoingHttpHeaders;
    body?: string | Stream.Readable;
    abort_signal: AbortSignal;
    enable_response_compression?: boolean;
    enable_request_compression?: boolean;
    try_decompress_response_stream?: boolean;
    parse_summary?: boolean;
    query: string;
}
export declare abstract class NodeBaseConnection implements Connection<Stream.Readable> {
    protected readonly params: NodeConnectionParams;
    protected readonly agent: Http.Agent;
    protected readonly defaultAuthHeader: string;
    protected readonly defaultHeaders: Http.OutgoingHttpHeaders;
    private readonly logger;
    private readonly knownSockets;
    private readonly idleSocketTTL;
    protected constructor(params: NodeConnectionParams, agent: Http.Agent);
    ping(params: ConnPingParams): Promise<ConnPingResult>;
    query(params: ConnBaseQueryParams): Promise<ConnQueryResult<Stream.Readable>>;
    insert(params: ConnInsertParams<Stream.Readable>): Promise<ConnInsertResult>;
    exec(params: ConnExecParams<Stream.Readable>): Promise<ConnExecResult<Stream.Readable>>;
    command(params: ConnBaseQueryParams): Promise<ConnCommandResult>;
    close(): Promise<void>;
    protected defaultHeadersWithOverride(params?: ConnBaseQueryParams): Http.OutgoingHttpHeaders;
    protected buildRequestHeaders(params?: ConnBaseQueryParams): Http.OutgoingHttpHeaders;
    protected abstract createClientRequest(params: RequestParams): Http.ClientRequest;
    private getQueryId;
    private getAbortController;
    private logResponse;
    private logRequestError;
    private httpRequestErrorMessage;
    private parseSummary;
    private runExec;
    private request;
}
