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
exports.wrapFieldResolver = exports.wrapFields = exports.getSourceFromLocation = exports.getOperation = exports.endSpan = exports.addSpanSource = exports.addInputVariableAttributes = exports.isPromise = void 0;
const api = require("@opentelemetry/api");
const enum_1 = require("./enum");
const AttributeNames_1 = require("./enums/AttributeNames");
const symbols_1 = require("./symbols");
const OPERATION_VALUES = Object.values(enum_1.AllowedOperationTypes);
// https://github.com/graphql/graphql-js/blob/main/src/jsutils/isPromise.ts
const isPromise = (value) => {
    return typeof (value === null || value === void 0 ? void 0 : value.then) === 'function';
};
exports.isPromise = isPromise;
// https://github.com/graphql/graphql-js/blob/main/src/jsutils/isObjectLike.ts
const isObjectLike = (value) => {
    return typeof value == 'object' && value !== null;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addInputVariableAttribute(span, key, variable) {
    if (Array.isArray(variable)) {
        variable.forEach((value, idx) => {
            addInputVariableAttribute(span, `${key}.${idx}`, value);
        });
    }
    else if (variable instanceof Object) {
        Object.entries(variable).forEach(([nestedKey, value]) => {
            addInputVariableAttribute(span, `${key}.${nestedKey}`, value);
        });
    }
    else {
        span.setAttribute(`${AttributeNames_1.AttributeNames.VARIABLES}${String(key)}`, variable);
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addInputVariableAttributes(span, variableValues) {
    Object.entries(variableValues).forEach(([key, value]) => {
        addInputVariableAttribute(span, key, value);
    });
}
exports.addInputVariableAttributes = addInputVariableAttributes;
function addSpanSource(span, loc, allowValues, start, end) {
    const source = getSourceFromLocation(loc, allowValues, start, end);
    span.setAttribute(AttributeNames_1.AttributeNames.SOURCE, source);
}
exports.addSpanSource = addSpanSource;
function createFieldIfNotExists(tracer, getConfig, contextValue, info, path) {
    let field = getField(contextValue, path);
    let spanAdded = false;
    if (!field) {
        spanAdded = true;
        const parent = getParentField(contextValue, path);
        field = {
            parent,
            span: createResolverSpan(tracer, getConfig, contextValue, info, path, parent.span),
            error: null,
        };
        addField(contextValue, path, field);
    }
    return { spanAdded, field };
}
function createResolverSpan(tracer, getConfig, contextValue, info, path, parentSpan) {
    var _a, _b;
    const attributes = {
        [AttributeNames_1.AttributeNames.FIELD_NAME]: info.fieldName,
        [AttributeNames_1.AttributeNames.FIELD_PATH]: path.join('.'),
        [AttributeNames_1.AttributeNames.FIELD_TYPE]: info.returnType.toString(),
    };
    const span = tracer.startSpan(`${enum_1.SpanNames.RESOLVE} ${attributes[AttributeNames_1.AttributeNames.FIELD_PATH]}`, {
        attributes,
    }, parentSpan ? api.trace.setSpan(api.context.active(), parentSpan) : undefined);
    const document = contextValue[symbols_1.OTEL_GRAPHQL_DATA_SYMBOL].source;
    const fieldNode = info.fieldNodes.find(fieldNode => fieldNode.kind === 'Field');
    if (fieldNode) {
        addSpanSource(span, document.loc, getConfig().allowValues, (_a = fieldNode.loc) === null || _a === void 0 ? void 0 : _a.start, (_b = fieldNode.loc) === null || _b === void 0 ? void 0 : _b.end);
    }
    return span;
}
function endSpan(span, error) {
    if (error) {
        span.recordException(error);
    }
    span.end();
}
exports.endSpan = endSpan;
function getOperation(document, operationName) {
    if (!document || !Array.isArray(document.definitions)) {
        return undefined;
    }
    if (operationName) {
        return document.definitions
            .filter(definition => { var _a; return OPERATION_VALUES.indexOf((_a = definition) === null || _a === void 0 ? void 0 : _a.operation) !== -1; })
            .find(definition => { var _a, _b; return operationName === ((_b = (_a = definition) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.value); });
    }
    else {
        return document.definitions.find(definition => { var _a; return OPERATION_VALUES.indexOf((_a = definition) === null || _a === void 0 ? void 0 : _a.operation) !== -1; });
    }
}
exports.getOperation = getOperation;
function addField(contextValue, path, field) {
    return (contextValue[symbols_1.OTEL_GRAPHQL_DATA_SYMBOL].fields[path.join('.')] =
        field);
}
function getField(contextValue, path) {
    return contextValue[symbols_1.OTEL_GRAPHQL_DATA_SYMBOL].fields[path.join('.')];
}
function getParentField(contextValue, path) {
    for (let i = path.length - 1; i > 0; i--) {
        const field = getField(contextValue, path.slice(0, i));
        if (field) {
            return field;
        }
    }
    return {
        span: contextValue[symbols_1.OTEL_GRAPHQL_DATA_SYMBOL].span,
    };
}
function pathToArray(mergeItems, path) {
    const flattened = [];
    let curr = path;
    while (curr) {
        let key = curr.key;
        if (mergeItems && typeof key === 'number') {
            key = '*';
        }
        flattened.push(String(key));
        curr = curr.prev;
    }
    return flattened.reverse();
}
function repeatBreak(i) {
    return repeatChar('\n', i);
}
function repeatSpace(i) {
    return repeatChar(' ', i);
}
function repeatChar(char, to) {
    let text = '';
    for (let i = 0; i < to; i++) {
        text += char;
    }
    return text;
}
const KindsToBeRemoved = [
    enum_1.TokenKind.FLOAT,
    enum_1.TokenKind.STRING,
    enum_1.TokenKind.INT,
    enum_1.TokenKind.BLOCK_STRING,
];
function getSourceFromLocation(loc, allowValues = false, inputStart, inputEnd) {
    var _a, _b;
    let source = '';
    if (loc === null || loc === void 0 ? void 0 : loc.startToken) {
        const start = typeof inputStart === 'number' ? inputStart : loc.start;
        const end = typeof inputEnd === 'number' ? inputEnd : loc.end;
        let next = loc.startToken.next;
        let previousLine = 1;
        while (next) {
            if (next.start < start) {
                next = next.next;
                previousLine = next === null || next === void 0 ? void 0 : next.line;
                continue;
            }
            if (next.end > end) {
                next = next.next;
                previousLine = next === null || next === void 0 ? void 0 : next.line;
                continue;
            }
            let value = next.value || next.kind;
            let space = '';
            if (!allowValues && KindsToBeRemoved.indexOf(next.kind) >= 0) {
                // value = repeatChar('*', value.length);
                value = '*';
            }
            if (next.kind === enum_1.TokenKind.STRING) {
                value = `"${value}"`;
            }
            if (next.kind === enum_1.TokenKind.EOF) {
                value = '';
            }
            if (next.line > previousLine) {
                source += repeatBreak(next.line - previousLine);
                previousLine = next.line;
                space = repeatSpace(next.column - 1);
            }
            else {
                if (next.line === ((_a = next.prev) === null || _a === void 0 ? void 0 : _a.line)) {
                    space = repeatSpace(next.start - (((_b = next.prev) === null || _b === void 0 ? void 0 : _b.end) || 0));
                }
            }
            source += space + value;
            if (next) {
                next = next.next;
            }
        }
    }
    return source;
}
exports.getSourceFromLocation = getSourceFromLocation;
function wrapFields(type, tracer, getConfig) {
    if (!type ||
        typeof type.getFields !== 'function' ||
        type[symbols_1.OTEL_PATCHED_SYMBOL]) {
        return;
    }
    const fields = type.getFields();
    type[symbols_1.OTEL_PATCHED_SYMBOL] = true;
    Object.keys(fields).forEach(key => {
        const field = fields[key];
        if (!field) {
            return;
        }
        if (field.resolve) {
            field.resolve = wrapFieldResolver(tracer, getConfig, field.resolve);
        }
        if (field.type) {
            let unwrappedType = field.type;
            while (unwrappedType.ofType) {
                unwrappedType = unwrappedType.ofType;
            }
            wrapFields(unwrappedType, tracer, getConfig);
        }
    });
}
exports.wrapFields = wrapFields;
const handleResolveSpanError = (resolveSpan, err, shouldEndSpan) => {
    if (!shouldEndSpan) {
        return;
    }
    resolveSpan.recordException(err);
    resolveSpan.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: err.message,
    });
    resolveSpan.end();
};
const handleResolveSpanSuccess = (resolveSpan, shouldEndSpan) => {
    if (!shouldEndSpan) {
        return;
    }
    resolveSpan.end();
};
function wrapFieldResolver(tracer, getConfig, fieldResolver, isDefaultResolver = false) {
    if (wrappedFieldResolver[symbols_1.OTEL_PATCHED_SYMBOL] ||
        typeof fieldResolver !== 'function') {
        return fieldResolver;
    }
    function wrappedFieldResolver(source, args, contextValue, info) {
        if (!fieldResolver) {
            return undefined;
        }
        const config = getConfig();
        // follows what graphql is doing to decide if this is a trivial resolver
        // for which we don't need to create a resolve span
        if (config.ignoreTrivialResolveSpans &&
            isDefaultResolver &&
            (isObjectLike(source) || typeof source === 'function')) {
            const property = source[info.fieldName];
            // a function execution is not trivial and should be recorder.
            // property which is not a function is just a value and we don't want a "resolve" span for it
            if (typeof property !== 'function') {
                return fieldResolver.call(this, source, args, contextValue, info);
            }
        }
        if (!contextValue[symbols_1.OTEL_GRAPHQL_DATA_SYMBOL]) {
            return fieldResolver.call(this, source, args, contextValue, info);
        }
        const path = pathToArray(config.mergeItems, info && info.path);
        const depth = path.filter((item) => typeof item === 'string').length;
        let field;
        let shouldEndSpan = false;
        if (config.depth >= 0 && config.depth < depth) {
            field = getParentField(contextValue, path);
        }
        else {
            const newField = createFieldIfNotExists(tracer, getConfig, contextValue, info, path);
            field = newField.field;
            shouldEndSpan = newField.spanAdded;
        }
        return api.context.with(api.trace.setSpan(api.context.active(), field.span), () => {
            try {
                const res = fieldResolver.call(this, source, args, contextValue, info);
                if ((0, exports.isPromise)(res)) {
                    return res.then((r) => {
                        handleResolveSpanSuccess(field.span, shouldEndSpan);
                        return r;
                    }, (err) => {
                        handleResolveSpanError(field.span, err, shouldEndSpan);
                        throw err;
                    });
                }
                else {
                    handleResolveSpanSuccess(field.span, shouldEndSpan);
                    return res;
                }
            }
            catch (err) {
                handleResolveSpanError(field.span, err, shouldEndSpan);
                throw err;
            }
        });
    }
    wrappedFieldResolver[symbols_1.OTEL_PATCHED_SYMBOL] = true;
    return wrappedFieldResolver;
}
exports.wrapFieldResolver = wrapFieldResolver;
//# sourceMappingURL=utils.js.map