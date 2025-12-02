"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CassandraDriverInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
/** @knipignore */
const version_1 = require("./version");
const supportedVersions = ['>=4.4.0 <5'];
class CassandraDriverInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        return new instrumentation_1.InstrumentationNodeModuleDefinition('cassandra-driver', supportedVersions, driverModule => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Client = driverModule.Client.prototype;
            if ((0, instrumentation_1.isWrapped)(Client['_execute'])) {
                this._unwrap(Client, '_execute');
            }
            if ((0, instrumentation_1.isWrapped)(Client.batch)) {
                this._unwrap(Client, 'batch');
            }
            if ((0, instrumentation_1.isWrapped)(Client.stream)) {
                this._unwrap(Client, 'stream');
            }
            this._wrap(Client, '_execute', this._getPatchedExecute());
            this._wrap(Client, 'batch', this._getPatchedBatch());
            this._wrap(Client, 'stream', this._getPatchedStream());
            return driverModule;
        }, driverModule => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Client = driverModule.Client.prototype;
            if ((0, instrumentation_1.isWrapped)(Client['_execute'])) {
                this._unwrap(Client, '_execute');
            }
            if ((0, instrumentation_1.isWrapped)(Client.batch)) {
                this._unwrap(Client, 'batch');
            }
            if ((0, instrumentation_1.isWrapped)(Client.stream)) {
                this._unwrap(Client, 'stream');
            }
        }, [
            new instrumentation_1.InstrumentationNodeModuleFile('cassandra-driver/lib/request-execution.js', supportedVersions, execution => {
                if ((0, instrumentation_1.isWrapped)(execution.prototype['_sendOnConnection'])) {
                    this._unwrap(execution.prototype, '_sendOnConnection');
                }
                this._wrap(execution.prototype, '_sendOnConnection', this._getPatchedSendOnConnection());
                return execution;
            }, execution => {
                if (execution === undefined)
                    return;
                this._unwrap(execution.prototype, '_sendOnConnection');
            }),
        ]);
    }
    _getMaxQueryLength() {
        var _a;
        return (_a = this.getConfig().maxQueryLength) !== null && _a !== void 0 ? _a : 65536;
    }
    _shouldIncludeDbStatement() {
        var _a;
        return (_a = this.getConfig().enhancedDatabaseReporting) !== null && _a !== void 0 ? _a : false;
    }
    _getPatchedExecute() {
        return (original) => {
            const plugin = this;
            return function patchedExecute(...args) {
                const span = plugin.startSpan({ op: 'execute', query: args[0] }, this);
                const execContext = api_1.trace.setSpan(api_1.context.active(), span);
                const execPromise = (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
                    return api_1.context.with(execContext, () => {
                        return original.apply(this, args);
                    });
                }, error => {
                    if (error) {
                        failSpan(span, error);
                    }
                });
                const wrappedPromise = wrapPromise(span, execPromise, (span, result) => {
                    plugin._callResponseHook(span, result);
                });
                return api_1.context.bind(execContext, wrappedPromise);
            };
        };
    }
    _getPatchedSendOnConnection() {
        return (original) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function patchedSendOnConnection(...args) {
                const span = api_1.trace.getSpan(api_1.context.active());
                const conn = this['_connection'];
                if (span !== undefined && conn !== undefined) {
                    const port = parseInt(conn.port, 10);
                    span.setAttribute(semantic_conventions_1.SEMATTRS_NET_PEER_NAME, conn.address);
                    if (!isNaN(port)) {
                        span.setAttribute(semantic_conventions_1.SEMATTRS_NET_PEER_PORT, port);
                    }
                }
                return original.apply(this, args);
            };
        };
    }
    _getPatchedBatch() {
        return (original) => {
            const plugin = this;
            return function patchedBatch(...args) {
                const queries = Array.isArray(args[0]) ? args[0] : [];
                const span = plugin.startSpan({ op: 'batch', query: combineQueries(queries) }, this);
                const batchContext = api_1.trace.setSpan(api_1.context.active(), span);
                if (typeof args[args.length - 1] === 'function') {
                    const originalCallback = args[args.length - 1];
                    const patchedCallback = function (...cbArgs) {
                        const error = cbArgs[0];
                        if (error) {
                            span.setStatus({
                                code: api_1.SpanStatusCode.ERROR,
                                message: error.message,
                            });
                            span.recordException(error);
                        }
                        span.end();
                        return originalCallback.apply(this, cbArgs);
                    };
                    args[args.length - 1] = patchedCallback;
                    return api_1.context.with(batchContext, () => {
                        return original.apply(this, args);
                    });
                }
                const batchPromise = (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
                    return original.apply(this, args);
                }, error => {
                    if (error) {
                        failSpan(span, error);
                    }
                });
                const wrappedPromise = wrapPromise(span, batchPromise);
                return api_1.context.bind(batchContext, wrappedPromise);
            };
        };
    }
    _getPatchedStream() {
        return (original) => {
            const plugin = this;
            return function patchedStream(...args) {
                // Since stream internally uses execute, there is no need to add DB_STATEMENT twice
                const span = plugin.startSpan({ op: 'stream' }, this);
                const callback = args[3];
                const endSpan = (error) => {
                    if (error) {
                        span.setStatus({
                            code: api_1.SpanStatusCode.ERROR,
                            message: error.message,
                        });
                        span.recordException(error);
                    }
                    span.end();
                };
                if (callback === undefined) {
                    args[3] = endSpan;
                }
                else if (typeof callback === 'function') {
                    const wrappedCallback = function (err) {
                        endSpan(err);
                        return callback.call(this, err);
                    };
                    args[3] = wrappedCallback;
                }
                return (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
                    return original.apply(this, args);
                }, error => {
                    if (error) {
                        failSpan(span, error);
                    }
                });
            };
        };
    }
    startSpan({ op, query }, client) {
        var _a, _b;
        const attributes = {
            [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_CASSANDRA,
        };
        if (this._shouldIncludeDbStatement() && query !== undefined) {
            const statement = truncateQuery(query, this._getMaxQueryLength());
            attributes[semantic_conventions_1.SEMATTRS_DB_STATEMENT] = statement;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = (_b = (_a = client.options) === null || _a === void 0 ? void 0 : _a.credentials) === null || _b === void 0 ? void 0 : _b.username;
        if (user) {
            attributes[semantic_conventions_1.SEMATTRS_DB_USER] = user;
        }
        if (client.keyspace) {
            attributes[semantic_conventions_1.SEMATTRS_DB_NAME] = client.keyspace;
        }
        return this.tracer.startSpan(`cassandra-driver.${op}`, {
            kind: api_1.SpanKind.CLIENT,
            attributes,
        });
    }
    _callResponseHook(span, response) {
        const { responseHook } = this.getConfig();
        if (!responseHook) {
            return;
        }
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => responseHook(span, { response: response }), e => {
            if (e) {
                this._diag.error('responseHook error', e);
            }
        }, true);
    }
}
exports.CassandraDriverInstrumentation = CassandraDriverInstrumentation;
function failSpan(span, error) {
    span.setStatus({
        code: api_1.SpanStatusCode.ERROR,
        message: error.message,
    });
    span.recordException(error);
    span.end();
}
function combineQueries(queries) {
    return queries
        .map(query => (typeof query === 'string' ? query : query.query))
        .join('\n');
}
function wrapPromise(span, promise, successCallback) {
    return promise
        .then(result => {
        return new Promise(resolve => {
            if (successCallback) {
                successCallback(span, result);
            }
            span.end();
            resolve(result);
        });
    })
        .catch((error) => {
        return new Promise((_, reject) => {
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: error.message,
            });
            span.recordException(error);
            span.end();
            reject(error);
        });
    });
}
function truncateQuery(query, maxQueryLength) {
    return String(query).substring(0, maxQueryLength);
}
//# sourceMappingURL=instrumentation.js.map