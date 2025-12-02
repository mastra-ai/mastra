"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCallbackResponse = exports.handlePromiseResponse = exports.getAttributesFromCollection = void 0;
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
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
function getAttributesFromCollection(collection) {
    return {
        [semantic_conventions_1.SEMATTRS_DB_MONGODB_COLLECTION]: collection.name,
        [semantic_conventions_1.SEMATTRS_DB_NAME]: collection.conn.name,
        [semantic_conventions_1.SEMATTRS_DB_USER]: collection.conn.user,
        [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: collection.conn.host,
        [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: collection.conn.port,
    };
}
exports.getAttributesFromCollection = getAttributesFromCollection;
function setErrorStatus(span, error = {}) {
    span.recordException(error);
    span.setStatus({
        code: api_1.SpanStatusCode.ERROR,
        message: `${error.message} ${error.code ? `\nMongoose Error Code: ${error.code}` : ''}`,
    });
}
function applyResponseHook(span, response, responseHook, moduleVersion = undefined) {
    if (!responseHook) {
        return;
    }
    (0, instrumentation_1.safeExecuteInTheMiddle)(() => responseHook(span, { moduleVersion, response }), e => {
        if (e) {
            api_1.diag.error('mongoose instrumentation: responseHook error', e);
        }
    }, true);
}
function handlePromiseResponse(execResponse, span, responseHook, moduleVersion = undefined) {
    if (!(execResponse instanceof Promise)) {
        applyResponseHook(span, execResponse, responseHook, moduleVersion);
        span.end();
        return execResponse;
    }
    return execResponse
        .then(response => {
        applyResponseHook(span, response, responseHook, moduleVersion);
        return response;
    })
        .catch(err => {
        setErrorStatus(span, err);
        throw err;
    })
        .finally(() => span.end());
}
exports.handlePromiseResponse = handlePromiseResponse;
function handleCallbackResponse(callback, exec, originalThis, span, args, responseHook, moduleVersion = undefined) {
    let callbackArgumentIndex = 0;
    if (args.length === 2) {
        callbackArgumentIndex = 1;
    }
    args[callbackArgumentIndex] = (err, response) => {
        err
            ? setErrorStatus(span, err)
            : applyResponseHook(span, response, responseHook, moduleVersion);
        span.end();
        return callback(err, response);
    };
    return exec.apply(originalThis, args);
}
exports.handleCallbackResponse = handleCallbackResponse;
//# sourceMappingURL=utils.js.map