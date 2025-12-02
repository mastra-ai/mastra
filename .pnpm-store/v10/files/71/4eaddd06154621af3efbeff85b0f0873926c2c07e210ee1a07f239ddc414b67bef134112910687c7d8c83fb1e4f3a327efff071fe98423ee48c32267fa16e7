"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryParamsStringify = void 0;
// Everything in this file is lifted from the generated openapi runtime.
// I need to create a small modification of the generated queryParamStringify
// function in order to fix an issue with array params.
//
// See https://github.com/pinecone-io/pinecone-ts-client/pull/74
function queryParamsStringify(params, prefix) {
    if (prefix === void 0) { prefix = ''; }
    return Object.keys(params)
        .map(function (key) { return querystringSingleKey(key, params[key], prefix); })
        .filter(function (part) { return part.length > 0; })
        .join('&');
}
exports.queryParamsStringify = queryParamsStringify;
function querystringSingleKey(key, value, keyPrefix) {
    if (keyPrefix === void 0) { keyPrefix = ''; }
    var fullKey = keyPrefix + (keyPrefix.length ? "[".concat(key, "]") : key);
    // This is a one line change from the default querystring implementation. Checking
    // with `Array.isArray` instead of `value instanceof Array` allows us to get the
    // the correct behavior when stringifying array params.
    if (Array.isArray(value)) {
        var multiValue = value
            .map(function (singleValue) { return encodeURIComponent(String(singleValue)); })
            .join("&".concat(encodeURIComponent(fullKey), "="));
        return "".concat(encodeURIComponent(fullKey), "=").concat(multiValue);
    }
    if (value instanceof Set) {
        var valueAsArray = Array.from(value);
        return querystringSingleKey(key, valueAsArray, keyPrefix);
    }
    if (value instanceof Date) {
        return "".concat(encodeURIComponent(fullKey), "=").concat(encodeURIComponent(value.toISOString()));
    }
    if (value instanceof Object) {
        return queryParamsStringify(value, fullKey);
    }
    return "".concat(encodeURIComponent(fullKey), "=").concat(encodeURIComponent(String(value)));
}
//# sourceMappingURL=queryParamsStringify.js.map