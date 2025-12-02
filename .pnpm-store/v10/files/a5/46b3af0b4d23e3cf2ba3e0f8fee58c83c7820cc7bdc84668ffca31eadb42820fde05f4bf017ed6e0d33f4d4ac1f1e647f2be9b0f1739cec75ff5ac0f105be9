"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const START_SPAN_FUNCTION = Symbol('opentelemetry.pubsub-propagation.start_span');
const END_SPAN_FUNCTION = Symbol('opentelemetry.pubsub-propagation.end_span');
const patchArrayFilter = (messages, tracer, loopContext) => {
    const origFunc = messages.filter;
    const patchedFunc = function (...args) {
        const newArray = origFunc.apply(this, args);
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
const patchArrayFunction = (messages, functionName, tracer, loopContext) => {
    const origFunc = messages[functionName];
    const patchedFunc = function (...arrFuncArgs) {
        const callback = arrFuncArgs[0];
        const wrappedCallback = function (...callbackArgs) {
            var _a;
            const message = callbackArgs[0];
            const messageSpan = (_a = message === null || message === void 0 ? void 0 : message[START_SPAN_FUNCTION]) === null || _a === void 0 ? void 0 : _a.call(message);
            if (!messageSpan)
                return callback.apply(this, callbackArgs);
            const res = api_1.context.with(api_1.trace.setSpan(loopContext, messageSpan), () => {
                var _a;
                let result;
                try {
                    result = callback.apply(this, callbackArgs);
                    if (isPromise(result)) {
                        const endSpan = () => { var _a; return (_a = message[END_SPAN_FUNCTION]) === null || _a === void 0 ? void 0 : _a.call(message); };
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
                const startSpanFunction = Object.getOwnPropertyDescriptor(message, START_SPAN_FUNCTION);
                startSpanFunction &&
                    Object.defineProperty(res, START_SPAN_FUNCTION, startSpanFunction);
                const endSpanFunction = Object.getOwnPropertyDescriptor(message, END_SPAN_FUNCTION);
                endSpanFunction &&
                    Object.defineProperty(res, END_SPAN_FUNCTION, endSpanFunction);
            }
            return res;
        };
        arrFuncArgs[0] = wrappedCallback;
        const funcResult = origFunc.apply(this, arrFuncArgs);
        if (Array.isArray(funcResult))
            patchArrayForProcessSpans(funcResult, tracer, loopContext);
        return funcResult;
    };
    Object.defineProperty(messages, functionName, {
        enumerable: false,
        value: patchedFunc,
    });
};
const patchArrayForProcessSpans = (messages, tracer, loopContext = api_1.context.active()) => {
    patchArrayFunction(messages, 'forEach', tracer, loopContext);
    patchArrayFunction(messages, 'map', tracer, loopContext);
    patchArrayFilter(messages, tracer, loopContext);
};
const startMessagingProcessSpan = (message, name, attributes, parentContext, propagatedContext, tracer, processHook) => {
    const links = [];
    const spanContext = api_1.trace.getSpanContext(propagatedContext);
    if (spanContext) {
        links.push({
            context: spanContext,
        });
    }
    const spanName = `${name} process`;
    const processSpan = tracer.startSpan(spanName, {
        kind: api_1.SpanKind.CONSUMER,
        attributes: Object.assign(Object.assign({}, attributes), { ['messaging.operation']: 'process' }),
        links,
    }, parentContext);
    Object.defineProperty(message, START_SPAN_FUNCTION, {
        enumerable: false,
        writable: true,
        value: () => processSpan,
    });
    Object.defineProperty(message, END_SPAN_FUNCTION, {
        enumerable: false,
        writable: true,
        value: () => {
            processSpan.end();
            Object.defineProperty(message, END_SPAN_FUNCTION, {
                enumerable: false,
                writable: true,
                value: () => { },
            });
        },
    });
    try {
        processHook === null || processHook === void 0 ? void 0 : processHook(processSpan, message);
    }
    catch (err) {
        api_1.diag.error('opentelemetry-pubsub-propagation: process hook error', err);
    }
    return processSpan;
};
const patchMessagesArrayToStartProcessSpans = ({ messages, tracer, parentContext, messageToSpanDetails, processHook, }) => {
    messages.forEach(message => {
        const { attributes, name, parentContext: propagatedContext, } = messageToSpanDetails(message);
        Object.defineProperty(message, START_SPAN_FUNCTION, {
            enumerable: false,
            writable: true,
            value: () => startMessagingProcessSpan(message, name, attributes, parentContext, propagatedContext, tracer, processHook),
        });
    });
};
exports.default = {
    patchMessagesArrayToStartProcessSpans,
    patchArrayForProcessSpans,
};
//# sourceMappingURL=pubsub-propagation.js.map