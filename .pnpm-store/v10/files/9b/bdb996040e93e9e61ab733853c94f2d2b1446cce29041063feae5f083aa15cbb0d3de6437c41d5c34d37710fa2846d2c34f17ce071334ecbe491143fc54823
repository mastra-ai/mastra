import type { ClickHouseSettings } from '../settings';
export type HttpHeader = number | string | string[];
export type HttpHeaders = Record<string, HttpHeader | undefined>;
export declare function withCompressionHeaders({ headers, enable_request_compression, enable_response_compression, }: {
    headers: HttpHeaders;
    enable_request_compression: boolean | undefined;
    enable_response_compression: boolean | undefined;
}): Record<string, string>;
export declare function withHttpSettings(clickhouse_settings?: ClickHouseSettings, compression?: boolean): ClickHouseSettings;
export declare function isSuccessfulResponse(statusCode?: number): boolean;
export declare function isJWTAuth(auth: unknown): auth is {
    access_token: string;
};
export declare function isCredentialsAuth(auth: unknown): auth is {
    username: string;
    password: string;
};
