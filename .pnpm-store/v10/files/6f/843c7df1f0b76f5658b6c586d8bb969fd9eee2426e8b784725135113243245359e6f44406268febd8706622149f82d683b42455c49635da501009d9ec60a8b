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
exports.safeExecuteInTheMiddleMaybePromise = exports.endSpan = exports.startSpan = void 0;
const api_1 = require("@opentelemetry/api");
const constants_1 = require("./constants");
/**
 * Starts Span
 * @param reply - reply function
 * @param tracer - tracer
 * @param spanName - span name
 * @param spanAttributes - span attributes
 */
function startSpan(reply, tracer, spanName, spanAttributes = {}) {
    const span = tracer.startSpan(spanName, { attributes: spanAttributes });
    const spans = reply[constants_1.spanRequestSymbol] || [];
    spans.push(span);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Object.defineProperty(reply, constants_1.spanRequestSymbol, {
        enumerable: false,
        configurable: true,
        value: spans,
    });
    return span;
}
exports.startSpan = startSpan;
/**
 * Ends span
 * @param reply - reply function
 * @param err - error
 */
function endSpan(reply, err) {
    const spans = reply[constants_1.spanRequestSymbol] || [];
    // there is no active span, or it has already ended
    if (!spans.length) {
        return;
    }
    spans.forEach(span => {
        if (err) {
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: err.message,
            });
            span.recordException(err);
        }
        span.end();
    });
    delete reply[constants_1.spanRequestSymbol];
}
exports.endSpan = endSpan;
function safeExecuteInTheMiddleMaybePromise(execute, onFinish, preventThrowingError) {
    let error;
    let result = undefined;
    try {
        result = execute();
        if (isPromise(result)) {
            result.then(res => onFinish(undefined, res), err => onFinish(err));
        }
    }
    catch (e) {
        error = e;
    }
    finally {
        if (!isPromise(result)) {
            onFinish(error, result);
            if (error && !preventThrowingError) {
                // eslint-disable-next-line no-unsafe-finally
                throw error;
            }
        }
        // eslint-disable-next-line no-unsafe-finally
        return result;
    }
}
exports.safeExecuteInTheMiddleMaybePromise = safeExecuteInTheMiddleMaybePromise;
function isPromise(val) {
    var _a;
    return ((typeof val === 'object' &&
        val &&
        typeof ((_a = Object.getOwnPropertyDescriptor(val, 'then')) === null || _a === void 0 ? void 0 : _a.value) ===
            'function') ||
        false);
}
//# sourceMappingURL=utils.js.map