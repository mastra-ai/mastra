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
exports.metadataCapture = exports._extractMethodAndService = exports._methodIsIgnored = exports._grpcStatusCodeToSpanStatus = exports._grpcStatusCodeToOpenTelemetryStatusCode = exports.findIndex = exports.URI_REGEX = void 0;
const api_1 = require("@opentelemetry/api");
// e.g., "dns:otel-productcatalogservice:8080" or "otel-productcatalogservice:8080" or "127.0.0.1:8080"
exports.URI_REGEX = /(?:([A-Za-z0-9+.-]+):(?:\/\/)?)?(?<name>[A-Za-z0-9+.-]+):(?<port>[0-9+.-]+)$/;
// Equivalent to lodash _.findIndex
const findIndex = (args, fn) => {
    let index = -1;
    for (const arg of args) {
        index++;
        if (fn(arg)) {
            return index;
        }
    }
    return -1;
};
exports.findIndex = findIndex;
/**
 * Convert a grpc status code to an opentelemetry SpanStatus code.
 * @param status
 */
const _grpcStatusCodeToOpenTelemetryStatusCode = (status) => {
    if (status !== undefined && status === 0) {
        return api_1.SpanStatusCode.UNSET;
    }
    return api_1.SpanStatusCode.ERROR;
};
exports._grpcStatusCodeToOpenTelemetryStatusCode = _grpcStatusCodeToOpenTelemetryStatusCode;
const _grpcStatusCodeToSpanStatus = (status) => {
    return { code: (0, exports._grpcStatusCodeToOpenTelemetryStatusCode)(status) };
};
exports._grpcStatusCodeToSpanStatus = _grpcStatusCodeToSpanStatus;
/**
 * Returns true if methodName matches pattern
 * @param methodName the name of the method
 * @param pattern Match pattern
 */
const _satisfiesPattern = (methodName, pattern) => {
    if (typeof pattern === 'string') {
        return pattern.toLowerCase() === methodName.toLowerCase();
    }
    else if (pattern instanceof RegExp) {
        return pattern.test(methodName);
    }
    else if (typeof pattern === 'function') {
        return pattern(methodName);
    }
    else {
        return false;
    }
};
/**
 * Returns true if the current plugin configuration
 * ignores the given method.
 * @param methodName the name of the method
 * @param ignoredMethods a list of matching patterns
 * @param onException an error handler for matching exceptions
 */
const _methodIsIgnored = (methodName, ignoredMethods) => {
    if (!ignoredMethods) {
        // No ignored gRPC methods
        return false;
    }
    for (const pattern of ignoredMethods) {
        if (_satisfiesPattern(methodName, pattern)) {
            return true;
        }
    }
    return false;
};
exports._methodIsIgnored = _methodIsIgnored;
/**
 * Return method and service values getting from grpc name/path
 * @param name the grpc name/path
 */
const _extractMethodAndService = (name) => {
    const serviceMethod = name.replace(/^\//, '').split('/');
    const service = serviceMethod.shift() || '';
    const method = serviceMethod.join('/');
    return {
        service,
        method,
    };
};
exports._extractMethodAndService = _extractMethodAndService;
function metadataCapture(type, metadataToAdd) {
    const normalizedMetadataAttributes = new Map(metadataToAdd.map(value => [
        value.toLowerCase(),
        value.toLowerCase().replace(/-/g, '_'),
    ]));
    return (span, metadata) => {
        for (const [capturedMetadata, normalizedMetadata,] of normalizedMetadataAttributes) {
            const metadataValues = metadata
                .get(capturedMetadata)
                .flatMap(value => (typeof value === 'string' ? value.toString() : []));
            if (metadataValues === undefined || metadataValues.length === 0) {
                continue;
            }
            const key = `rpc.${type}.metadata.${normalizedMetadata}`;
            span.setAttribute(key, metadataValues);
        }
    };
}
exports.metadataCapture = metadataCapture;
//# sourceMappingURL=utils.js.map