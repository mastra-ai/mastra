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
exports.shouldNotTraceServerCall = exports.handleUntracedServerFunction = exports.handleServerFunction = exports.CALL_SPAN_ENDED = void 0;
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const utils_1 = require("./utils");
const AttributeNames_1 = require("./enums/AttributeNames");
const status_code_1 = require("./status-code");
exports.CALL_SPAN_ENDED = Symbol('opentelemetry call span ended');
/**
 * Handle patching for serverStream and Bidi type server handlers
 */
function serverStreamAndBidiHandler(span, call, original) {
    let spanEnded = false;
    const endSpan = () => {
        if (!spanEnded) {
            spanEnded = true;
            span.end();
        }
    };
    api_1.context.bind(api_1.context.active(), call);
    call.on('finish', () => {
        // @grpc/js does not expose a way to check if this call also emitted an error,
        // e.g. call.status.code !== 0
        if (call[exports.CALL_SPAN_ENDED]) {
            return;
        }
        // Set the "grpc call had an error" flag
        call[exports.CALL_SPAN_ENDED] = true;
        span.setStatus({
            code: api_1.SpanStatusCode.UNSET,
        });
        span.setAttribute(semantic_conventions_1.SEMATTRS_RPC_GRPC_STATUS_CODE, status_code_1.GRPC_STATUS_CODE_OK);
        endSpan();
    });
    call.on('error', (err) => {
        if (call[exports.CALL_SPAN_ENDED]) {
            return;
        }
        // Set the "grpc call had an error" flag
        call[exports.CALL_SPAN_ENDED] = true;
        span.setStatus({
            code: (0, utils_1._grpcStatusCodeToOpenTelemetryStatusCode)(err.code),
            message: err.message,
        });
        span.setAttributes({
            [AttributeNames_1.AttributeNames.GRPC_ERROR_NAME]: err.name,
            [AttributeNames_1.AttributeNames.GRPC_ERROR_MESSAGE]: err.message,
            [semantic_conventions_1.SEMATTRS_RPC_GRPC_STATUS_CODE]: err.code,
        });
        endSpan();
    });
    // Types of parameters 'call' and 'call' are incompatible.
    return original.call({}, call);
}
/**
 * Handle patching for clientStream and unary type server handlers
 */
function clientStreamAndUnaryHandler(span, call, callback, original) {
    const patchedCallback = (err, value) => {
        if (err) {
            if (err.code) {
                span.setStatus({
                    code: (0, utils_1._grpcStatusCodeToOpenTelemetryStatusCode)(err.code),
                    message: err.message,
                });
                span.setAttribute(semantic_conventions_1.SEMATTRS_RPC_GRPC_STATUS_CODE, err.code);
            }
            span.setAttributes({
                [AttributeNames_1.AttributeNames.GRPC_ERROR_NAME]: err.name,
                [AttributeNames_1.AttributeNames.GRPC_ERROR_MESSAGE]: err.message,
            });
        }
        else {
            span.setStatus({ code: api_1.SpanStatusCode.UNSET });
            span.setAttribute(semantic_conventions_1.SEMATTRS_RPC_GRPC_STATUS_CODE, status_code_1.GRPC_STATUS_CODE_OK);
        }
        span.end();
        return callback(err, value);
    };
    api_1.context.bind(api_1.context.active(), call);
    return original.call({}, call, patchedCallback);
}
/**
 * Patch callback or EventEmitter provided by `originalFunc` and set appropriate `span`
 * properties based on its result.
 */
function handleServerFunction(span, type, originalFunc, call, callback) {
    switch (type) {
        case 'unary':
        case 'clientStream':
        case 'client_stream':
            return clientStreamAndUnaryHandler(span, call, callback, originalFunc);
        case 'serverStream':
        case 'server_stream':
        case 'bidi':
            return serverStreamAndBidiHandler(span, call, originalFunc);
        default:
            break;
    }
}
exports.handleServerFunction = handleServerFunction;
/**
 * Does not patch any callbacks or EventEmitters to omit tracing on requests
 * that should not be traced.
 */
function handleUntracedServerFunction(type, originalFunc, call, callback) {
    switch (type) {
        case 'unary':
        case 'clientStream':
        case 'client_stream':
            return originalFunc.call({}, call, callback);
        case 'serverStream':
        case 'server_stream':
        case 'bidi':
            return originalFunc.call({}, call);
        default:
            break;
    }
}
exports.handleUntracedServerFunction = handleUntracedServerFunction;
/**
 * Returns true if the server call should not be traced.
 */
function shouldNotTraceServerCall(methodName, ignoreGrpcMethods) {
    const parsedName = methodName.split('/');
    return (0, utils_1._methodIsIgnored)(parsedName[parsedName.length - 1] || methodName, ignoreGrpcMethods);
}
exports.shouldNotTraceServerCall = shouldNotTraceServerCall;
//# sourceMappingURL=serverUtils.js.map