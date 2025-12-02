import type { InsertValues, ResponseHeaders } from './clickhouse_types';
import type { Connection, ConnectionParams } from './connection';
import type { DataFormat } from './data_formatter';
import type { Logger } from './logger';
import { ClickHouseLogLevel } from './logger';
import type { BaseResultSet } from './result';
import type { ClickHouseSettings } from './settings';
export interface BaseClickHouseClientConfigOptions {
    /** @deprecated since version 1.0.0. Use {@link url} instead. <br/>
     *  A ClickHouse instance URL.
     *  @default http://localhost:8123 */
    host?: string;
    /** A ClickHouse instance URL.
     *  @default http://localhost:8123 */
    url?: string | URL;
    /** An optional pathname to add to the ClickHouse URL after it is parsed by the client.
     *  For example, if you use a proxy, and your ClickHouse instance can be accessed as http://proxy:8123/clickhouse_server,
     *  specify `clickhouse_server` here (with or without a leading slash);
     *  otherwise, if provided directly in the {@link url}, it will be considered as the `database` option.<br/>
     *  Multiple segments are supported, e.g. `/my_proxy/db`.
     *  @default empty string */
    pathname?: string;
    /** The request timeout in milliseconds.
     *  @default 30_000 */
    request_timeout?: number;
    /** Maximum number of sockets to allow per host.
     *  @default 10 */
    max_open_connections?: number;
    /** Request and response compression settings. */
    compression?: {
        /** `response: true` instructs ClickHouse server to respond with compressed response body. <br/>
         *  This will add `Accept-Encoding: gzip` header in the request and `enable_http_compression=1` ClickHouse HTTP setting.
         *  <p><b>Warning</b>: Response compression can't be enabled for a user with readonly=1, as ClickHouse will not allow settings modifications for such user.</p>
         *  @default false */
        response?: boolean;
        /** `request: true` enabled compression on the client request body.
         *  @default false */
        request?: boolean;
    };
    /** The name of the user on whose behalf requests are made.
     *  Should not be set if {@link access_token} is provided.
     *  @default default */
    username?: string;
    /** The user password.
     *  Should not be set if {@link access_token} is provided.
     *  @default empty string */
    password?: string;
    /** A JWT access token to authenticate with ClickHouse.
     *  JWT token authentication is supported in ClickHouse Cloud only.
     *  Should not be set if {@link username} or {@link password} are provided.
     *  @default empty */
    access_token?: string;
    /** The name of the application using the JS client.
     *  @default empty string */
    application?: string;
    /** Database name to use.
     * @default default */
    database?: string;
    /** ClickHouse settings to apply to all requests.
     *  @default empty object */
    clickhouse_settings?: ClickHouseSettings;
    log?: {
        /** A class to instantiate a custom logger implementation.
         *  @default see {@link DefaultLogger} */
        LoggerClass?: new () => Logger;
        /** @default set to {@link ClickHouseLogLevel.OFF} */
        level?: ClickHouseLogLevel;
    };
    /** ClickHouse Session id to attach to the outgoing requests.
     *  @default empty string (no session) */
    session_id?: string;
    /** ClickHouse role name(s) to attach to the outgoing requests.
     *  @default undefined string (no roles) */
    role?: string | Array<string>;
    /** @deprecated since version 1.0.0. Use {@link http_headers} instead. <br/>
     *  Additional HTTP headers to attach to the outgoing requests.
     *  @default empty object */
    additional_headers?: Record<string, string>;
    /** Additional HTTP headers to attach to the outgoing requests.
     *  @default empty object */
    http_headers?: Record<string, string>;
    /** HTTP Keep-Alive related settings. */
    keep_alive?: {
        /** Enable or disable HTTP Keep-Alive mechanism.
         *  @default true */
        enabled?: boolean;
    };
}
export type MakeConnection<Stream, Config = BaseClickHouseClientConfigOptionsWithURL> = (config: Config, params: ConnectionParams) => Connection<Stream>;
export type MakeResultSet<Stream> = <Format extends DataFormat, ResultSet extends BaseResultSet<Stream, Format>>(stream: Stream, format: Format, query_id: string, log_error: (err: Error) => void, response_headers: ResponseHeaders) => ResultSet;
export interface ValuesEncoder<Stream> {
    validateInsertValues<T = unknown>(values: InsertValues<Stream, T>, format: DataFormat): void;
    /**
     * A function encodes an array or a stream of JSON objects to a format compatible with ClickHouse.
     * If values are provided as an array of JSON objects, the function encodes it in place.
     * If values are provided as a stream of JSON objects, the function sets up the encoding of each chunk.
     * If values are provided as a raw non-object stream, the function does nothing.
     *
     * @param values a set of values to send to ClickHouse.
     * @param format a format to encode value to.
     */
    encodeValues<T = unknown>(values: InsertValues<Stream, T>, format: DataFormat): string | Stream;
}
/**
 * An implementation might have extra config parameters that we can parse from the connection URL.
 * These are supposed to be processed after we finish parsing the base configuration.
 * URL params handled in the common package will be deleted from the URL object.
 * This way we ensure that only implementation-specific params are passed there,
 * so we can indicate which URL parameters are unknown by both common and implementation packages.
 */
export type HandleImplSpecificURLParams = (config: BaseClickHouseClientConfigOptions, url: URL) => {
    config: BaseClickHouseClientConfigOptions;
    handled_params: Set<string>;
    unknown_params: Set<string>;
};
/** Things that may vary between Web/Node.js/etc client implementations. */
export interface ImplementationDetails<Stream> {
    impl: {
        make_connection: MakeConnection<Stream>;
        make_result_set: MakeResultSet<Stream>;
        values_encoder: ValuesEncoder<Stream>;
        handle_specific_url_params?: HandleImplSpecificURLParams;
    };
}
export type BaseClickHouseClientConfigOptionsWithURL = Omit<BaseClickHouseClientConfigOptions, 'url'> & {
    url: URL;
};
/**
 * Validates and normalizes the provided "base" config.
 * Warns about deprecated configuration parameters usage.
 * Parses the common URL parameters into the configuration parameters (these are the same for all implementations).
 * Parses implementation-specific URL parameters using the handler provided by that implementation.
 * Merges these parameters with the base config and implementation-specific defaults.
 * Enforces certain defaults in case of deprecated keys or readonly mode.
 */
export declare function prepareConfigWithURL(baseConfigOptions: BaseClickHouseClientConfigOptions, logger: Logger, handleImplURLParams: HandleImplSpecificURLParams | null): BaseClickHouseClientConfigOptionsWithURL;
export declare function getConnectionParams(config: BaseClickHouseClientConfigOptionsWithURL, logger: Logger): ConnectionParams;
/**
 * Merge two versions of the config: base (hardcoded) from the instance creation and the URL parsed one.
 * URL config takes priority and overrides the base config parameters.
 * If a value is overridden, then a warning will be logged (even if the log level is OFF).
 */
export declare function mergeConfigs(baseConfig: BaseClickHouseClientConfigOptions, configFromURL: BaseClickHouseClientConfigOptions, logger: Logger): BaseClickHouseClientConfigOptions;
export declare function createUrl(configURL: string | URL | undefined): URL;
/**
 * @param url potentially contains auth, database and URL params to parse the configuration from
 * @param handleExtraURLParams some platform-specific URL params might be unknown by the common package;
 * use this function defined in the implementation to handle them. Logs warnings in case of hardcode overrides.
 */
export declare function loadConfigOptionsFromURL(url: URL, handleExtraURLParams: HandleImplSpecificURLParams | null): [URL, BaseClickHouseClientConfigOptions];
export declare function booleanConfigURLValue({ key, value, }: {
    key: string;
    value: string;
}): boolean;
export declare function numberConfigURLValue({ key, value, min, max, }: {
    key: string;
    value: string;
    min?: number;
    max?: number;
}): number;
export declare function enumConfigURLValue<Enum, Key extends string>({ key, value, enumObject, }: {
    key: string;
    value: string;
    enumObject: {
        [k in Key]: Enum;
    };
}): Enum;
