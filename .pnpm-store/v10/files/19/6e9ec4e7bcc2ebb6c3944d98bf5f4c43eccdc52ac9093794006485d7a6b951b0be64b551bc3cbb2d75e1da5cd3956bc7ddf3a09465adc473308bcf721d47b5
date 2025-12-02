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
exports.setSpanContext = exports.extractMetadataOrSpliceDefault = exports.extractMetadataOrSplice = exports.getMetadataIndex = exports.makeGrpcClientRemoteCall = exports.patchResponseStreamEvents = exports.patchResponseMetadataEvent = exports.patchedCallback = exports.getMethodsToWrap = void 0;
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const AttributeNames_1 = require("./enums/AttributeNames");
const status_code_1 = require("./status-code");
const utils_1 = require("./utils");
const events_1 = require("events");
/**
 * Parse a package method list and return a list of methods to patch
 * with both possible casings e.g. "TestMethod" & "testMethod"
 */
function getMethodsToWrap(client, methods) {
    const methodList = [];
    // For a method defined in .proto as "UnaryMethod"
    Object.entries(methods).forEach(([name, { originalName }]) => {
        if (!(0, utils_1._methodIsIgnored)(name, this.getConfig().ignoreGrpcMethods)) {
            methodList.push(name); // adds camel case method name: "unaryMethod"
            if (originalName &&
                // eslint-disable-next-line no-prototype-builtins
                client.prototype.hasOwnProperty(originalName) &&
                name !== originalName // do not add duplicates
            ) {
                // adds original method name: "UnaryMethod",
                methodList.push(originalName);
            }
        }
    });
    return methodList;
}
exports.getMethodsToWrap = getMethodsToWrap;
/**
 * Patches a callback so that the current span for this trace is also ended
 * when the callback is invoked.
 */
function patchedCallback(span, callback) {
    const wrappedFn = (err, res) => {
        if (err) {
            if (err.code) {
                span.setStatus((0, utils_1._grpcStatusCodeToSpanStatus)(err.code));
                span.setAttribute(semantic_conventions_1.SEMATTRS_RPC_GRPC_STATUS_CODE, err.code);
            }
            span.setAttributes({
                [AttributeNames_1.AttributeNames.GRPC_ERROR_NAME]: err.name,
                [AttributeNames_1.AttributeNames.GRPC_ERROR_MESSAGE]: err.message,
            });
        }
        else {
            span.setAttribute(semantic_conventions_1.SEMATTRS_RPC_GRPC_STATUS_CODE, status_code_1.GRPC_STATUS_CODE_OK);
        }
        span.end();
        callback(err, res);
    };
    return api_1.context.bind(api_1.context.active(), wrappedFn);
}
exports.patchedCallback = patchedCallback;
function patchResponseMetadataEvent(span, call, metadataCapture) {
    call.on('metadata', (responseMetadata) => {
        metadataCapture.client.captureResponseMetadata(span, responseMetadata);
    });
}
exports.patchResponseMetadataEvent = patchResponseMetadataEvent;
function patchResponseStreamEvents(span, call) {
    // Both error and status events can be emitted
    // the first one emitted set spanEnded to true
    let spanEnded = false;
    const endSpan = () => {
        if (!spanEnded) {
            span.end();
            spanEnded = true;
        }
    };
    api_1.context.bind(api_1.context.active(), call);
    call.on(events_1.errorMonitor, (err) => {
        if (spanEnded) {
            return;
        }
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
    call.on('status', (status) => {
        if (spanEnded) {
            return;
        }
        span.setStatus((0, utils_1._grpcStatusCodeToSpanStatus)(status.code));
        span.setAttribute(semantic_conventions_1.SEMATTRS_RPC_GRPC_STATUS_CODE, status.code);
        endSpan();
    });
}
exports.patchResponseStreamEvents = patchResponseStreamEvents;
/**
 * Execute grpc client call. Apply completion span properties and end the
 * span on callback or receiving an emitted event.
 */
function makeGrpcClientRemoteCall(metadataCapture, original, args, metadata, self) {
    return (span) => {
        // if unary or clientStream
        if (!original.responseStream) {
            const callbackFuncIndex = args.findIndex(arg => {
                return typeof arg === 'function';
            });
            if (callbackFuncIndex !== -1) {
                args[callbackFuncIndex] = patchedCallback(span, args[callbackFuncIndex]);
            }
        }
        setSpanContext(metadata);
        const call = original.apply(self, args);
        call.on('metadata', responseMetadata => {
            metadataCapture.client.captureResponseMetadata(span, responseMetadata);
        });
        // if server stream or bidi
        if (original.responseStream) {
            patchResponseStreamEvents(span, call);
        }
        return call;
    };
}
exports.makeGrpcClientRemoteCall = makeGrpcClientRemoteCall;
function getMetadataIndex(args) {
    // This finds an instance of Metadata among the arguments.
    // A possible issue that could occur is if the 'options' parameter from
    // the user contains an '_internal_repr' as well as a 'getMap' function,
    // but this is an extremely rare case.
    return args.findIndex((arg) => {
        return (arg &&
            typeof arg === 'object' &&
            arg['internalRepr'] && // changed from _internal_repr in grpc --> @grpc/grpc-js https://github.com/grpc/grpc-node/blob/95289edcaf36979cccf12797cc27335da8d01f03/packages/grpc-js/src/metadata.ts#L88
            typeof arg.getMap === 'function');
    });
}
exports.getMetadataIndex = getMetadataIndex;
/**
 * Returns the metadata argument from user provided arguments (`args`)
 * If no metadata is provided in `args`: adds empty metadata to `args` and returns that empty metadata
 */
function extractMetadataOrSplice(grpcLib, args, spliceIndex) {
    let metadata;
    const metadataIndex = getMetadataIndex(args);
    if (metadataIndex === -1) {
        // Create metadata if it does not exist
        metadata = new grpcLib.Metadata();
        args.splice(spliceIndex, 0, metadata);
    }
    else {
        metadata = args[metadataIndex];
    }
    return metadata;
}
exports.extractMetadataOrSplice = extractMetadataOrSplice;
/**
 * Returns the metadata argument from user provided arguments (`args`)
 * Adds empty metadata to arguments if the default is used.
 */
function extractMetadataOrSpliceDefault(grpcClient, original, args) {
    return extractMetadataOrSplice(grpcClient, args, original.requestStream ? 0 : 1);
}
exports.extractMetadataOrSpliceDefault = extractMetadataOrSpliceDefault;
/**
 * Inject opentelemetry trace context into `metadata` for use by another
 * grpc receiver
 * @param metadata
 */
function setSpanContext(metadata) {
    api_1.propagation.inject(api_1.context.active(), metadata, {
        set: (meta, k, v) => meta.set(k, v),
    });
}
exports.setSpanContext = setSpanContext;
//# sourceMappingURL=clientUtils.js.map