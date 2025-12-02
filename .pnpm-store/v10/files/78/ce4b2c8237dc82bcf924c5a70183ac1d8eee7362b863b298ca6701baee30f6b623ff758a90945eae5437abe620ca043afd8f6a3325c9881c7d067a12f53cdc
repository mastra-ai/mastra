"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeBaseConnection = void 0;
const client_common_1 = require("@clickhouse/client-common");
const crypto_1 = __importDefault(require("crypto"));
const stream_1 = __importDefault(require("stream"));
const zlib_1 = __importDefault(require("zlib"));
const utils_1 = require("../utils");
const compression_1 = require("./compression");
const stream_2 = require("./stream");
class NodeBaseConnection {
    constructor(params, agent) {
        Object.defineProperty(this, "params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: params
        });
        Object.defineProperty(this, "agent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: agent
        });
        Object.defineProperty(this, "defaultAuthHeader", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultHeaders", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "knownSockets", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakMap()
        });
        Object.defineProperty(this, "idleSocketTTL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (params.auth.type === 'Credentials') {
            this.defaultAuthHeader = `Basic ${Buffer.from(`${params.auth.username}:${params.auth.password}`).toString('base64')}`;
        }
        else if (params.auth.type === 'JWT') {
            this.defaultAuthHeader = `Bearer ${params.auth.access_token}`;
        }
        else {
            throw new Error(`Unknown auth type: ${params.auth.type}`);
        }
        this.defaultHeaders = {
            // Node.js HTTP agent, for some reason, does not set this on its own when KeepAlive is enabled
            Connection: this.params.keep_alive.enabled ? 'keep-alive' : 'close',
            'User-Agent': (0, utils_1.getUserAgent)(this.params.application_id),
        };
        this.logger = params.log_writer;
        this.idleSocketTTL = params.keep_alive.idle_socket_ttl;
    }
    async ping(params) {
        const query_id = this.getQueryId(params.query_id);
        const { controller, controllerCleanup } = this.getAbortController(params);
        let result;
        try {
            if (params.select) {
                const searchParams = (0, client_common_1.toSearchParams)({
                    database: undefined,
                    query: PingQuery,
                    query_id,
                });
                result = await this.request({
                    method: 'GET',
                    url: (0, client_common_1.transformUrl)({ url: this.params.url, searchParams }),
                    query: PingQuery,
                    abort_signal: controller.signal,
                    headers: this.buildRequestHeaders(),
                }, 'Ping');
            }
            else {
                result = await this.request({
                    method: 'GET',
                    url: (0, client_common_1.transformUrl)({ url: this.params.url, pathname: '/ping' }),
                    abort_signal: controller.signal,
                    headers: this.buildRequestHeaders(),
                    query: 'ping',
                }, 'Ping');
            }
            await (0, stream_2.drainStream)(result.stream);
            return { success: true };
        }
        catch (error) {
            // it is used to ensure that the outgoing request is terminated,
            // and we don't get unhandled error propagation later
            controller.abort('Ping failed');
            // not an error, as this might be semi-expected
            this.logger.warn({
                message: this.httpRequestErrorMessage('Ping'),
                err: error,
                args: {
                    query_id,
                },
            });
            return {
                success: false,
                error: error, // should NOT be propagated to the user
            };
        }
        finally {
            controllerCleanup();
        }
    }
    async query(params) {
        const query_id = this.getQueryId(params.query_id);
        const clickhouse_settings = (0, client_common_1.withHttpSettings)(params.clickhouse_settings, this.params.compression.decompress_response);
        const searchParams = (0, client_common_1.toSearchParams)({
            database: this.params.database,
            query_params: params.query_params,
            session_id: params.session_id,
            clickhouse_settings,
            query_id,
            role: params.role,
        });
        const { controller, controllerCleanup } = this.getAbortController(params);
        // allows enforcing the compression via the settings even if the client instance has it disabled
        const enableResponseCompression = clickhouse_settings.enable_http_compression === 1;
        try {
            const { response_headers, stream } = await this.request({
                method: 'POST',
                url: (0, client_common_1.transformUrl)({ url: this.params.url, searchParams }),
                body: params.query,
                abort_signal: controller.signal,
                enable_response_compression: enableResponseCompression,
                headers: this.buildRequestHeaders(params),
                query: params.query,
            }, 'Query');
            return {
                stream,
                response_headers,
                query_id,
            };
        }
        catch (err) {
            controller.abort('Query HTTP request failed');
            this.logRequestError({
                op: 'Query',
                query_id: query_id,
                query_params: params,
                search_params: searchParams,
                err: err,
                extra_args: {
                    decompress_response: enableResponseCompression,
                    clickhouse_settings,
                },
            });
            throw err; // should be propagated to the user
        }
        finally {
            controllerCleanup();
        }
    }
    async insert(params) {
        const query_id = this.getQueryId(params.query_id);
        const searchParams = (0, client_common_1.toSearchParams)({
            database: this.params.database,
            clickhouse_settings: params.clickhouse_settings,
            query_params: params.query_params,
            query: params.query,
            session_id: params.session_id,
            role: params.role,
            query_id,
        });
        const { controller, controllerCleanup } = this.getAbortController(params);
        try {
            const { stream, summary, response_headers } = await this.request({
                method: 'POST',
                url: (0, client_common_1.transformUrl)({ url: this.params.url, searchParams }),
                body: params.values,
                abort_signal: controller.signal,
                enable_request_compression: this.params.compression.compress_request,
                parse_summary: true,
                headers: this.buildRequestHeaders(params),
                query: params.query,
            }, 'Insert');
            await (0, stream_2.drainStream)(stream);
            return { query_id, summary, response_headers };
        }
        catch (err) {
            controller.abort('Insert HTTP request failed');
            this.logRequestError({
                op: 'Insert',
                query_id: query_id,
                query_params: params,
                search_params: searchParams,
                err: err,
                extra_args: {
                    clickhouse_settings: params.clickhouse_settings ?? {},
                },
            });
            throw err; // should be propagated to the user
        }
        finally {
            controllerCleanup();
        }
    }
    async exec(params) {
        return this.runExec({
            ...params,
            op: 'Exec',
        });
    }
    async command(params) {
        const { stream, query_id, summary, response_headers } = await this.runExec({
            ...params,
            op: 'Command',
        });
        // ignore the response stream and release the socket immediately
        await (0, stream_2.drainStream)(stream);
        return { query_id, summary, response_headers };
    }
    async close() {
        if (this.agent !== undefined && this.agent.destroy !== undefined) {
            this.agent.destroy();
        }
    }
    defaultHeadersWithOverride(params) {
        return {
            // Custom HTTP headers from the client configuration
            ...(this.params.http_headers ?? {}),
            // Custom HTTP headers for this particular request; it will override the client configuration with the same keys
            ...(params?.http_headers ?? {}),
            // Includes the `Connection` + `User-Agent` headers which we do not allow to override
            // An appropriate `Authorization` header might be added later
            // It is not always required - see the TLS headers in `node_https_connection.ts`
            ...this.defaultHeaders,
        };
    }
    buildRequestHeaders(params) {
        const headers = this.defaultHeadersWithOverride(params);
        if ((0, client_common_1.isJWTAuth)(params?.auth)) {
            return {
                ...headers,
                Authorization: `Bearer ${params.auth.access_token}`,
            };
        }
        if (this.params.set_basic_auth_header) {
            if ((0, client_common_1.isCredentialsAuth)(params?.auth)) {
                return {
                    ...headers,
                    Authorization: `Basic ${Buffer.from(`${params.auth.username}:${params.auth.password}`).toString('base64')}`,
                };
            }
            else {
                return {
                    ...headers,
                    Authorization: this.defaultAuthHeader,
                };
            }
        }
        return {
            ...headers,
        };
    }
    getQueryId(query_id) {
        return query_id || crypto_1.default.randomUUID();
    }
    // a wrapper over the user's Signal to terminate the failed requests
    getAbortController(params) {
        const controller = new AbortController();
        function onAbort() {
            controller.abort();
        }
        params.abort_signal?.addEventListener('abort', onAbort);
        return {
            controller,
            controllerCleanup: () => {
                params.abort_signal?.removeEventListener('abort', onAbort);
            },
        };
    }
    logResponse(op, request, params, response, startTimestamp) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { authorization, host, ...headers } = request.getHeaders();
        const duration = Date.now() - startTimestamp;
        this.params.log_writer.debug({
            module: 'HTTP Adapter',
            message: `${op}: got a response from ClickHouse`,
            args: {
                request_method: params.method,
                request_path: params.url.pathname,
                request_params: params.url.search,
                request_headers: headers,
                response_status: response.statusCode,
                response_headers: response.headers,
                response_time_ms: duration,
            },
        });
    }
    logRequestError({ op, err, query_id, query_params, search_params, extra_args, }) {
        this.logger.error({
            message: this.httpRequestErrorMessage(op),
            err: err,
            args: {
                query: query_params.query,
                search_params: search_params?.toString() ?? '',
                with_abort_signal: query_params.abort_signal !== undefined,
                session_id: query_params.session_id,
                query_id: query_id,
                ...extra_args,
            },
        });
    }
    httpRequestErrorMessage(op) {
        return `${op}: HTTP request error.`;
    }
    parseSummary(op, response) {
        const summaryHeader = response.headers['x-clickhouse-summary'];
        if (typeof summaryHeader === 'string') {
            try {
                return JSON.parse(summaryHeader);
            }
            catch (err) {
                this.logger.error({
                    message: `${op}: failed to parse X-ClickHouse-Summary header.`,
                    args: {
                        'X-ClickHouse-Summary': summaryHeader,
                    },
                    err: err,
                });
            }
        }
    }
    async runExec(params) {
        const query_id = this.getQueryId(params.query_id);
        const sendQueryInParams = params.values !== undefined;
        const clickhouse_settings = (0, client_common_1.withHttpSettings)(params.clickhouse_settings, this.params.compression.decompress_response);
        const toSearchParamsOptions = {
            query: sendQueryInParams ? params.query : undefined,
            database: this.params.database,
            query_params: params.query_params,
            session_id: params.session_id,
            role: params.role,
            clickhouse_settings,
            query_id,
        };
        const searchParams = (0, client_common_1.toSearchParams)(toSearchParamsOptions);
        const { controller, controllerCleanup } = this.getAbortController(params);
        const tryDecompressResponseStream = params.op === 'Exec'
            ? // allows disabling stream decompression for the `Exec` operation only
                (params.decompress_response_stream ??
                    this.params.compression.decompress_response)
            : // there is nothing useful in the response stream for the `Command` operation,
                // and it is immediately destroyed; never decompress it
                false;
        try {
            const { stream, summary, response_headers } = await this.request({
                method: 'POST',
                url: (0, client_common_1.transformUrl)({ url: this.params.url, searchParams }),
                body: sendQueryInParams ? params.values : params.query,
                abort_signal: controller.signal,
                parse_summary: true,
                enable_request_compression: this.params.compression.compress_request,
                enable_response_compression: this.params.compression.decompress_response,
                try_decompress_response_stream: tryDecompressResponseStream,
                headers: this.buildRequestHeaders(params),
                query: params.query,
            }, params.op);
            return {
                stream,
                query_id,
                summary,
                response_headers,
            };
        }
        catch (err) {
            controller.abort(`${params.op} HTTP request failed`);
            this.logRequestError({
                op: params.op,
                query_id: query_id,
                query_params: params,
                search_params: searchParams,
                err: err,
                extra_args: {
                    clickhouse_settings: params.clickhouse_settings ?? {},
                },
            });
            throw err; // should be propagated to the user
        }
        finally {
            controllerCleanup();
        }
    }
    async request(params, op) {
        // allows the event loop to process the idle socket timers, if the CPU load is high
        // otherwise, we can occasionally get an expired socket, see https://github.com/ClickHouse/clickhouse-js/issues/294
        await (0, client_common_1.sleep)(0);
        const currentStackTrace = this.params.capture_enhanced_stack_trace
            ? (0, client_common_1.getCurrentStackTrace)()
            : undefined;
        const logger = this.logger;
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const request = this.createClientRequest(params);
            function onError(e) {
                removeRequestListeners();
                const err = (0, client_common_1.enhanceStackTrace)(e, currentStackTrace);
                reject(err);
            }
            let responseStream;
            const onResponse = async (_response) => {
                this.logResponse(op, request, params, _response, start);
                const tryDecompressResponseStream = params.try_decompress_response_stream ?? true;
                // even if the stream decompression is disabled, we have to decompress it in case of an error
                const isFailedResponse = !(0, client_common_1.isSuccessfulResponse)(_response.statusCode);
                if (tryDecompressResponseStream || isFailedResponse) {
                    const decompressionResult = (0, compression_1.decompressResponse)(_response, this.logger);
                    if ((0, compression_1.isDecompressionError)(decompressionResult)) {
                        const err = (0, client_common_1.enhanceStackTrace)(decompressionResult.error, currentStackTrace);
                        return reject(err);
                    }
                    responseStream = decompressionResult.response;
                }
                else {
                    responseStream = _response;
                }
                if (isFailedResponse) {
                    try {
                        const errorMessage = await (0, utils_1.getAsText)(responseStream);
                        const err = (0, client_common_1.enhanceStackTrace)((0, client_common_1.parseError)(errorMessage), currentStackTrace);
                        reject(err);
                    }
                    catch (e) {
                        // If the ClickHouse response is malformed
                        const err = (0, client_common_1.enhanceStackTrace)(e, currentStackTrace);
                        reject(err);
                    }
                }
                else {
                    return resolve({
                        stream: responseStream,
                        summary: params.parse_summary
                            ? this.parseSummary(op, _response)
                            : undefined,
                        response_headers: { ..._response.headers },
                    });
                }
            };
            function onAbort() {
                // Prefer 'abort' event since it always triggered unlike 'error' and 'close'
                // see the full sequence of events https://nodejs.org/api/http.html#httprequesturl-options-callback
                removeRequestListeners();
                request.once('error', function () {
                    /**
                     * catch "Error: ECONNRESET" error which shouldn't be reported to users.
                     * see the full sequence of events https://nodejs.org/api/http.html#httprequesturl-options-callback
                     * */
                });
                const err = (0, client_common_1.enhanceStackTrace)(new Error('The user aborted a request.'), currentStackTrace);
                reject(err);
            }
            function onClose() {
                // Adapter uses 'close' event to clean up listeners after the successful response.
                // It's necessary in order to handle 'abort' and 'timeout' events while response is streamed.
                // It's always the last event, according to https://nodejs.org/docs/latest-v14.x/api/http.html#http_http_request_url_options_callback
                removeRequestListeners();
            }
            function pipeStream() {
                // if request.end() was called due to no data to send
                if (request.writableEnded) {
                    return;
                }
                const bodyStream = (0, utils_1.isStream)(params.body)
                    ? params.body
                    : stream_1.default.Readable.from([params.body]);
                const callback = (e) => {
                    if (e) {
                        removeRequestListeners();
                        const err = (0, client_common_1.enhanceStackTrace)(e, currentStackTrace);
                        reject(err);
                    }
                };
                if (params.enable_request_compression) {
                    stream_1.default.pipeline(bodyStream, zlib_1.default.createGzip(), request, callback);
                }
                else {
                    stream_1.default.pipeline(bodyStream, request, callback);
                }
            }
            const onSocket = (socket) => {
                try {
                    if (this.params.keep_alive.enabled &&
                        this.params.keep_alive.idle_socket_ttl > 0) {
                        const socketInfo = this.knownSockets.get(socket);
                        // It is the first time we've encountered this socket,
                        // so it doesn't have the idle timeout handler attached to it
                        if (socketInfo === undefined) {
                            const socketId = crypto_1.default.randomUUID();
                            this.logger.trace({
                                message: `Using a fresh socket ${socketId}, setting up a new 'free' listener`,
                            });
                            this.knownSockets.set(socket, {
                                id: socketId,
                                idle_timeout_handle: undefined,
                            });
                            // When the request is complete and the socket is released,
                            // make sure that the socket is removed after `idleSocketTTL`.
                            socket.on('free', () => {
                                this.logger.trace({
                                    message: `Socket ${socketId} was released`,
                                });
                                // Avoiding the built-in socket.timeout() method usage here,
                                // as we don't want to clash with the actual request timeout.
                                const idleTimeoutHandle = setTimeout(() => {
                                    this.logger.trace({
                                        message: `Removing socket ${socketId} after ${this.idleSocketTTL} ms of idle`,
                                    });
                                    this.knownSockets.delete(socket);
                                    socket.destroy();
                                }, this.idleSocketTTL).unref();
                                this.knownSockets.set(socket, {
                                    id: socketId,
                                    idle_timeout_handle: idleTimeoutHandle,
                                });
                            });
                            const cleanup = () => {
                                const maybeSocketInfo = this.knownSockets.get(socket);
                                // clean up a possibly dangling idle timeout handle (preventing leaks)
                                if (maybeSocketInfo?.idle_timeout_handle) {
                                    clearTimeout(maybeSocketInfo.idle_timeout_handle);
                                }
                                this.logger.trace({
                                    message: `Socket ${socketId} was closed or ended, 'free' listener removed`,
                                });
                                if (responseStream && !responseStream.readableEnded) {
                                    this.logger.warn({
                                        message: `${op}: socket was closed or ended before the response was fully read. ` +
                                            'This can potentially result in an uncaught ECONNRESET error! ' +
                                            'Consider fully consuming, draining, or destroying the response stream.',
                                        args: {
                                            query: params.query,
                                            query_id: params.url.searchParams.get('query_id') ?? 'unknown',
                                        },
                                    });
                                }
                            };
                            socket.once('end', cleanup);
                            socket.once('close', cleanup);
                        }
                        else {
                            clearTimeout(socketInfo.idle_timeout_handle);
                            this.logger.trace({
                                message: `Reusing socket ${socketInfo.id}`,
                            });
                            this.knownSockets.set(socket, {
                                ...socketInfo,
                                idle_timeout_handle: undefined,
                            });
                        }
                    }
                }
                catch (e) {
                    logger.error({
                        message: 'An error occurred while housekeeping the idle sockets',
                        err: e,
                    });
                }
                // Socket is "prepared" with idle handlers, continue with our request
                pipeStream();
                // This is for request timeout only. Surprisingly, it is not always enough to set in the HTTP request.
                // The socket won't be destroyed, and it will be returned to the pool.
                socket.setTimeout(this.params.request_timeout, onTimeout);
            };
            function onTimeout() {
                const err = (0, client_common_1.enhanceStackTrace)(new Error('Timeout error.'), currentStackTrace);
                removeRequestListeners();
                try {
                    request.destroy();
                }
                catch (e) {
                    logger.error({
                        message: 'An error occurred while destroying the request',
                        err: e,
                    });
                }
                reject(err);
            }
            function removeRequestListeners() {
                if (request.socket !== null) {
                    request.socket.setTimeout(0); // reset previously set timeout
                    request.socket.removeListener('timeout', onTimeout);
                }
                request.removeListener('socket', onSocket);
                request.removeListener('response', onResponse);
                request.removeListener('error', onError);
                request.removeListener('close', onClose);
                if (params.abort_signal !== undefined) {
                    request.removeListener('abort', onAbort);
                }
            }
            request.on('socket', onSocket);
            request.on('response', onResponse);
            request.on('error', onError);
            request.on('close', onClose);
            if (params.abort_signal !== undefined) {
                params.abort_signal.addEventListener('abort', onAbort, {
                    once: true,
                });
            }
            if (!params.body) {
                try {
                    return request.end();
                }
                catch (e) {
                    this.logger.error({
                        message: 'An error occurred while ending the request without body',
                        err: e,
                    });
                }
            }
        });
    }
}
exports.NodeBaseConnection = NodeBaseConnection;
const PingQuery = `SELECT 'ping'`;
//# sourceMappingURL=node_base_connection.js.map