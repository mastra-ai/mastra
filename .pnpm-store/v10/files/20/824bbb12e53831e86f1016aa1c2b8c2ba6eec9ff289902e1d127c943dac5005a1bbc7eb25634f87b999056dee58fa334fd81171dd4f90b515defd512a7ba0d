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
exports.getTracedInternalSendCommand = exports.getTracedCreateStreamTrace = exports.getTracedCreateClient = void 0;
const api_1 = require("@opentelemetry/api");
const _1 = require("./");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const redis_common_1 = require("@opentelemetry/redis-common");
const endSpan = (span, err) => {
    if (err) {
        span.setStatus({
            code: api_1.SpanStatusCode.ERROR,
            message: err.message,
        });
    }
    span.end();
};
const getTracedCreateClient = (tracer, original) => {
    return function createClientTrace() {
        const client = original.apply(this, arguments);
        return api_1.context.bind(api_1.context.active(), client);
    };
};
exports.getTracedCreateClient = getTracedCreateClient;
const getTracedCreateStreamTrace = (tracer, original) => {
    return function create_stream_trace() {
        if (!Object.prototype.hasOwnProperty.call(this, 'stream')) {
            Object.defineProperty(this, 'stream', {
                get() {
                    return this._patched_redis_stream;
                },
                set(val) {
                    api_1.context.bind(api_1.context.active(), val);
                    this._patched_redis_stream = val;
                },
            });
        }
        return original.apply(this, arguments);
    };
};
exports.getTracedCreateStreamTrace = getTracedCreateStreamTrace;
const getTracedInternalSendCommand = (tracer, original, config) => {
    return function internal_send_command_trace(cmd) {
        // New versions of redis (2.4+) use a single options object
        // instead of named arguments
        if (arguments.length !== 1 || typeof cmd !== 'object') {
            // We don't know how to trace this call, so don't start/stop a span
            return original.apply(this, arguments);
        }
        const hasNoParentSpan = api_1.trace.getSpan(api_1.context.active()) === undefined;
        if ((config === null || config === void 0 ? void 0 : config.requireParentSpan) === true && hasNoParentSpan) {
            return original.apply(this, arguments);
        }
        const dbStatementSerializer = (config === null || config === void 0 ? void 0 : config.dbStatementSerializer) || redis_common_1.defaultDbStatementSerializer;
        const span = tracer.startSpan(`${_1.RedisInstrumentation.COMPONENT}-${cmd.command}`, {
            kind: api_1.SpanKind.CLIENT,
            attributes: {
                [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_REDIS,
                [semantic_conventions_1.SEMATTRS_DB_STATEMENT]: dbStatementSerializer(cmd.command, cmd.args),
            },
        });
        // Set attributes for not explicitly typed RedisPluginClientTypes
        if (this.connection_options) {
            span.setAttributes({
                [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: this.connection_options.host,
                [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: this.connection_options.port,
            });
        }
        if (this.address) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_DB_CONNECTION_STRING, `redis://${this.address}`);
        }
        const originalCallback = arguments[0].callback;
        if (originalCallback) {
            const originalContext = api_1.context.active();
            arguments[0].callback = function callback(err, reply) {
                if (config === null || config === void 0 ? void 0 : config.responseHook) {
                    const responseHook = config.responseHook;
                    (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
                        responseHook(span, cmd.command, cmd.args, reply);
                    }, err => {
                        if (err) {
                            api_1.diag.error('Error executing responseHook', err);
                        }
                    }, true);
                }
                endSpan(span, err);
                return api_1.context.with(originalContext, originalCallback, this, ...arguments);
            };
        }
        try {
            // Span will be ended in callback
            return original.apply(this, arguments);
        }
        catch (rethrow) {
            endSpan(span, rethrow);
            throw rethrow; // rethrow after ending span
        }
    };
};
exports.getTracedInternalSendCommand = getTracedInternalSendCommand;
//# sourceMappingURL=utils.js.map