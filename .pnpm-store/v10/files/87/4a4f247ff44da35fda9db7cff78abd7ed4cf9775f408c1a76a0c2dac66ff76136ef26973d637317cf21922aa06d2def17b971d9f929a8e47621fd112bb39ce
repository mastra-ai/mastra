"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickHouseClient = void 0;
const client_common_1 = require("@clickhouse/client-common");
const config_1 = require("./config");
class ClickHouseClient {
    constructor(config) {
        Object.defineProperty(this, "clientClickHouseSettings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "connectionParams", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "connection", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "makeResultSet", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "valuesEncoder", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sessionId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "role", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logWriter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const logger = config?.log?.LoggerClass
            ? new config.log.LoggerClass()
            : new client_common_1.DefaultLogger();
        const configWithURL = (0, config_1.prepareConfigWithURL)(config, logger, config.impl.handle_specific_url_params ?? null);
        this.connectionParams = (0, config_1.getConnectionParams)(configWithURL, logger);
        this.logWriter = this.connectionParams.log_writer;
        this.clientClickHouseSettings = this.connectionParams.clickhouse_settings;
        this.sessionId = config.session_id;
        this.role = config.role;
        this.connection = config.impl.make_connection(configWithURL, this.connectionParams);
        this.makeResultSet = config.impl.make_result_set;
        this.valuesEncoder = config.impl.values_encoder;
    }
    /**
     * Used for most statements that can have a response, such as `SELECT`.
     * FORMAT clause should be specified separately via {@link QueryParams.format} (default is `JSON`).
     * Consider using {@link ClickHouseClient.insert} for data insertion, or {@link ClickHouseClient.command} for DDLs.
     * Returns an implementation of {@link BaseResultSet}.
     *
     * See {@link DataFormat} for the formats supported by the client.
     */
    async query(params) {
        const format = params.format ?? 'JSON';
        const query = formatQuery(params.query, format);
        const queryParams = this.withClientQueryParams(params);
        const { stream, query_id, response_headers } = await this.connection.query({
            query,
            ...queryParams,
        });
        return this.makeResultSet(stream, format, query_id, (err) => {
            this.logWriter.error({
                err,
                module: 'Client',
                message: 'Error while processing the ResultSet.',
                args: {
                    session_id: queryParams.session_id,
                    role: queryParams.role,
                    query,
                    query_id,
                },
            });
        }, response_headers);
    }
    /**
     * It should be used for statements that do not have any output,
     * when the format clause is not applicable, or when you are not interested in the response at all.
     * The response stream is destroyed immediately as we do not expect useful information there.
     * Examples of such statements are DDLs or custom inserts.
     *
     * @note if you have a custom query that does not work with {@link ClickHouseClient.query},
     * and you are interested in the response data, consider using {@link ClickHouseClient.exec}.
     */
    async command(params) {
        const query = removeTrailingSemi(params.query.trim());
        return await this.connection.command({
            query,
            ...this.withClientQueryParams(params),
        });
    }
    /**
     * Similar to {@link ClickHouseClient.command}, but for the cases where the output _is expected_,
     * but format clause is not applicable. The caller of this method _must_ consume the stream,
     * as the underlying socket will not be released until then, and the request will eventually be timed out.
     *
     * @note it is not intended to use this method to execute the DDLs, such as `CREATE TABLE` or similar;
     * use {@link ClickHouseClient.command} instead.
     */
    async exec(params) {
        const query = removeTrailingSemi(params.query.trim());
        const values = 'values' in params ? params.values : undefined;
        const decompress_response_stream = params.decompress_response_stream ?? true;
        return await this.connection.exec({
            query,
            values,
            decompress_response_stream,
            ...this.withClientQueryParams(params),
        });
    }
    /**
     * The primary method for data insertion. It is recommended to avoid arrays in case of large inserts
     * to reduce application memory consumption and consider streaming for most of such use cases.
     * As the insert operation does not provide any output, the response stream is immediately destroyed.
     *
     * @note in case of a custom insert operation (e.g., `INSERT FROM SELECT`),
     * consider using {@link ClickHouseClient.command}, passing the entire raw query there
     * (including the `FORMAT` clause).
     */
    async insert(params) {
        if (Array.isArray(params.values) && params.values.length === 0) {
            return { executed: false, query_id: '', response_headers: {} };
        }
        const format = params.format || 'JSONCompactEachRow';
        this.valuesEncoder.validateInsertValues(params.values, format);
        const query = getInsertQuery(params, format);
        const result = await this.connection.insert({
            query,
            values: this.valuesEncoder.encodeValues(params.values, format),
            ...this.withClientQueryParams(params),
        });
        return { ...result, executed: true };
    }
    /**
     * A health-check request. It does not throw if an error occurs - the error is returned inside the result object.
     *
     * By default, Node.js version uses the built-in `/ping` endpoint, which does not verify credentials.
     * Optionally, it can be switched to a `SELECT` query (see {@link PingParamsWithSelectQuery}).
     * In that case, the server will verify the credentials.
     *
     * **NOTE**: Since the `/ping` endpoint does not support CORS, the Web version always uses a `SELECT` query.
     */
    async ping(params) {
        return await this.connection.ping(params ?? { select: false });
    }
    /**
     * Shuts down the underlying connection.
     * This method should ideally be called only once per application lifecycle,
     * for example, during the graceful shutdown phase.
     */
    async close() {
        return await this.connection.close();
    }
    withClientQueryParams(params) {
        return {
            clickhouse_settings: {
                ...this.clientClickHouseSettings,
                ...params.clickhouse_settings,
            },
            query_params: params.query_params,
            abort_signal: params.abort_signal,
            query_id: params.query_id,
            session_id: params.session_id ?? this.sessionId,
            role: params.role ?? this.role,
            auth: params.auth,
            http_headers: params.http_headers,
        };
    }
}
exports.ClickHouseClient = ClickHouseClient;
function formatQuery(query, format) {
    query = query.trim();
    query = removeTrailingSemi(query);
    return query + ' \nFORMAT ' + format;
}
function removeTrailingSemi(query) {
    let lastNonSemiIdx = query.length;
    for (let i = lastNonSemiIdx; i > 0; i--) {
        if (query[i - 1] !== ';') {
            lastNonSemiIdx = i;
            break;
        }
    }
    if (lastNonSemiIdx !== query.length) {
        return query.slice(0, lastNonSemiIdx);
    }
    return query;
}
function isInsertColumnsExcept(obj) {
    return (obj !== undefined &&
        obj !== null &&
        typeof obj === 'object' &&
        // Avoiding ESLint no-prototype-builtins error
        Object.prototype.hasOwnProperty.call(obj, 'except'));
}
function getInsertQuery(params, format) {
    let columnsPart = '';
    if (params.columns !== undefined) {
        if (Array.isArray(params.columns) && params.columns.length > 0) {
            columnsPart = ` (${params.columns.join(', ')})`;
        }
        else if (isInsertColumnsExcept(params.columns) &&
            params.columns.except.length > 0) {
            columnsPart = ` (* EXCEPT (${params.columns.except.join(', ')}))`;
        }
    }
    return `INSERT INTO ${params.table.trim()}${columnsPart} FORMAT ${format}`;
}
//# sourceMappingURL=client.js.map