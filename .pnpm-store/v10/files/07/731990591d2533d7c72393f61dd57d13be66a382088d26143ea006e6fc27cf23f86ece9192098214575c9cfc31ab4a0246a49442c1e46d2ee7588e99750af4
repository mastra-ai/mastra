import type { WithClickHouseSummary, WithResponseHeaders } from './clickhouse_types';
import type { LogWriter } from './logger';
import type { ClickHouseSettings } from './settings';
export type ConnectionAuth = {
    username: string;
    password: string;
    type: 'Credentials';
} | {
    access_token: string;
    type: 'JWT';
};
export interface ConnectionParams {
    url: URL;
    request_timeout: number;
    max_open_connections: number;
    compression: CompressionSettings;
    database: string;
    clickhouse_settings: ClickHouseSettings;
    log_writer: LogWriter;
    keep_alive: {
        enabled: boolean;
    };
    application_id?: string;
    http_headers?: Record<string, string>;
    auth: ConnectionAuth;
}
export interface CompressionSettings {
    decompress_response: boolean;
    compress_request: boolean;
}
export interface ConnBaseQueryParams {
    query: string;
    clickhouse_settings?: ClickHouseSettings;
    query_params?: Record<string, unknown>;
    abort_signal?: AbortSignal;
    session_id?: string;
    query_id?: string;
    auth?: {
        username: string;
        password: string;
    } | {
        access_token: string;
    };
    role?: string | Array<string>;
    http_headers?: Record<string, string>;
}
export type ConnPingParams = {
    select: boolean;
} & Omit<ConnBaseQueryParams, 'query' | 'query_params'>;
export interface ConnInsertParams<Stream> extends ConnBaseQueryParams {
    values: string | Stream;
}
export interface ConnExecParams<Stream> extends ConnBaseQueryParams {
    values?: Stream;
    decompress_response_stream?: boolean;
}
export interface ConnBaseResult extends WithResponseHeaders {
    query_id: string;
}
export interface ConnQueryResult<Stream> extends ConnBaseResult {
    stream: Stream;
    query_id: string;
}
export type ConnInsertResult = ConnBaseResult & WithClickHouseSummary;
export type ConnExecResult<Stream> = ConnQueryResult<Stream> & WithClickHouseSummary;
export type ConnCommandResult = ConnBaseResult & WithClickHouseSummary;
export type ConnPingResult = {
    success: true;
} | {
    success: false;
    error: Error;
};
export type ConnOperation = 'Ping' | 'Query' | 'Insert' | 'Exec' | 'Command';
export interface Connection<Stream> {
    ping(params: ConnPingParams): Promise<ConnPingResult>;
    query(params: ConnBaseQueryParams): Promise<ConnQueryResult<Stream>>;
    insert(params: ConnInsertParams<Stream>): Promise<ConnInsertResult>;
    command(params: ConnBaseQueryParams): Promise<ConnCommandResult>;
    exec(params: ConnExecParams<Stream>): Promise<ConnExecResult<Stream>>;
    close(): Promise<void>;
}
