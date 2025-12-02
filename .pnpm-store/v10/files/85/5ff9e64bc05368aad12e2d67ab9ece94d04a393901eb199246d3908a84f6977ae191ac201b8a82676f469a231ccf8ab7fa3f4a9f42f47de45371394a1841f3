var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
import { SpanKind, context, trace, diag, } from '@opentelemetry/api';
var START_SPAN_FUNCTION = Symbol('opentelemetry.pubsub-propagation.start_span');
var END_SPAN_FUNCTION = Symbol('opentelemetry.pubsub-propagation.end_span');
var patchArrayFilter = function (messages, tracer, loopContext) {
    var origFunc = messages.filter;
    var patchedFunc = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var newArray = origFunc.apply(this, args);
        patchArrayForProcessSpans(newArray, tracer, loopContext);
        return newArray;
    };
    Object.defineProperty(messages, 'filter', {
        enumerable: false,
        value: patchedFunc,
    });
};
function isPromise(value) {
    var _a;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof ((_a = value) === null || _a === void 0 ? void 0 : _a.then) === 'function';
}
var patchArrayFunction = function (messages, functionName, tracer, loopContext) {
    var origFunc = messages[functionName];
    var patchedFunc = function () {
        var arrFuncArgs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            arrFuncArgs[_i] = arguments[_i];
        }
        var callback = arrFuncArgs[0];
        var wrappedCallback = function () {
            var _this = this;
            var _a;
            var callbackArgs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                callbackArgs[_i] = arguments[_i];
            }
            var message = callbackArgs[0];
            var messageSpan = (_a = message === null || message === void 0 ? void 0 : message[START_SPAN_FUNCTION]) === null || _a === void 0 ? void 0 : _a.call(message);
            if (!messageSpan)
                return callback.apply(this, callbackArgs);
            var res = context.with(trace.setSpan(loopContext, messageSpan), function () {
                var _a;
                var result;
                try {
                    result = callback.apply(_this, callbackArgs);
                    if (isPromise(result)) {
                        var endSpan = function () { var _a; return (_a = message[END_SPAN_FUNCTION]) === null || _a === void 0 ? void 0 : _a.call(message); };
                        result.then(endSpan, endSpan);
                    }
                    return result;
                }
                finally {
                    if (!isPromise(result)) {
                        (_a = message[END_SPAN_FUNCTION]) === null || _a === void 0 ? void 0 : _a.call(message);
                    }
                }
            });
            if (typeof res === 'object') {
                var startSpanFunction = Object.getOwnPropertyDescriptor(message, START_SPAN_FUNCTION);
                startSpanFunction &&
                    Object.defineProperty(res, START_SPAN_FUNCTION, startSpanFunction);
                var endSpanFunction = Object.getOwnPropertyDescriptor(message, END_SPAN_FUNCTION);
                endSpanFunction &&
                    Object.defineProperty(res, END_SPAN_FUNCTION, endSpanFunction);
            }
            return res;
        };
        arrFuncArgs[0] = wrappedCallback;
        var funcResult = origFunc.apply(this, arrFuncArgs);
        if (Array.isArray(funcResult))
            patchArrayForProcessSpans(funcResult, tracer, loopContext);
        return funcResult;
    };
    Object.defineProperty(messages, functionName, {
        enumerable: false,
        value: patchedFunc,
    });
};
var patchArrayForProcessSpans = function (messages, tracer, loopContext) {
    if (loopContext === void 0) { loopContext = context.active(); }
    patchArrayFunction(messages, 'forEach', tracer, loopContext);
    patchArrayFunction(messages, 'map', tracer, loopContext);
    patchArrayFilter(messages, tracer, loopContext);
};
var startMessagingProcessSpan = function (message, name, attributes, parentContext, propagatedContext, tracer, processHook) {
    var _a;
    var links = [];
    var spanContext = trace.getSpanContext(propagatedContext);
    if (spanContext) {
        links.push({
            context: spanContext,
        });
    }
    var spanName = name + " process";
    var processSpan = tracer.startSpan(spanName, {
        kind: SpanKind.CONSUMER,
        attributes: __assign(__assign({}, attributes), (_a = {}, _a['messaging.operation'] = 'process', _a)),
        links: links,
    }, parentContext);
    Object.defineProperty(message, START_SPAN_FUNCTION, {
        enumerable: false,
        writable: true,
        value: function () { return processSpan; },
    });
    Object.defineProperty(message, END_SPAN_FUNCTION, {
        enumerable: false,
        writable: true,
        value: function () {
            processSpan.end();
            Object.defineProperty(message, END_SPAN_FUNCTION, {
                enumerable: false,
                writable: true,
                value: function () { },
            });
        },
    });
    try {
        processHook === null || processHook === void 0 ? void 0 : processHook(processSpan, message);
    }
    catch (err) {
        diag.error('opentelemetry-pubsub-propagation: process hook error', err);
    }
    return processSpan;
};
var patchMessagesArrayToStartProcessSpans = function (_a) {
    var messages = _a.messages, tracer = _a.tracer, parentContext = _a.parentContext, messageToSpanDetails = _a.messageToSpanDetails, processHook = _a.processHook;
    messages.forEach(function (message) {
        var _a = messageToSpanDetails(message), attributes = _a.attributes, name = _a.name, propagatedContext = _a.parentContext;
        Object.defineProperty(message, START_SPAN_FUNCTION, {
            enumerable: false,
            writable: true,
            value: function () {
                return startMessagingProcessSpan(message, name, attributes, parentContext, propagatedContext, tracer, processHook);
            },
        });
    });
};
export default {
    patchMessagesArrayToStartProcessSpans: patchMessagesArrayToStartProcessSpans,
    patchArrayForProcessSpans: patchArrayForProcessSpans,
};
//# sourceMappingURL=pubsub-propagation.js.map