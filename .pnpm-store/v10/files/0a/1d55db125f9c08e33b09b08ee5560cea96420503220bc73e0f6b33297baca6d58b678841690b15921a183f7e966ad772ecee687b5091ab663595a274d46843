import { supportsAbortSignal } from '../core/constants.js';
import { isObject } from './is.js';
export const validateAndMerge = (...sources) => {
    for (const source of sources) {
        if ((!isObject(source) || Array.isArray(source)) && source !== undefined) {
            throw new TypeError('The `options` argument must be an object');
        }
    }
    return deepMerge({}, ...sources);
};
export const mergeHeaders = (source1 = {}, source2 = {}) => {
    const result = new globalThis.Headers(source1);
    const isHeadersInstance = source2 instanceof globalThis.Headers;
    const source = new globalThis.Headers(source2);
    for (const [key, value] of source.entries()) {
        if ((isHeadersInstance && value === 'undefined') || value === undefined) {
            result.delete(key);
        }
        else {
            result.set(key, value);
        }
    }
    return result;
};
function newHookValue(original, incoming, property) {
    return (Object.hasOwn(incoming, property) && incoming[property] === undefined)
        ? []
        : deepMerge(original[property] ?? [], incoming[property] ?? []);
}
export const mergeHooks = (original = {}, incoming = {}) => ({
    beforeRequest: newHookValue(original, incoming, 'beforeRequest'),
    beforeRetry: newHookValue(original, incoming, 'beforeRetry'),
    afterResponse: newHookValue(original, incoming, 'afterResponse'),
    beforeError: newHookValue(original, incoming, 'beforeError'),
});
const appendSearchParameters = (target, source) => {
    const result = new URLSearchParams();
    for (const input of [target, source]) {
        if (input === undefined) {
            continue;
        }
        if (input instanceof URLSearchParams) {
            for (const [key, value] of input.entries()) {
                result.append(key, value);
            }
        }
        else if (Array.isArray(input)) {
            for (const pair of input) {
                if (!Array.isArray(pair) || pair.length !== 2) {
                    throw new TypeError('Array search parameters must be provided in [[key, value], ...] format');
                }
                result.append(String(pair[0]), String(pair[1]));
            }
        }
        else if (isObject(input)) {
            for (const [key, value] of Object.entries(input)) {
                if (value !== undefined) {
                    result.append(key, String(value));
                }
            }
        }
        else {
            // String
            const parameters = new URLSearchParams(input);
            for (const [key, value] of parameters.entries()) {
                result.append(key, value);
            }
        }
    }
    return result;
};
// TODO: Make this strongly-typed (no `any`).
export const deepMerge = (...sources) => {
    let returnValue = {};
    let headers = {};
    let hooks = {};
    let searchParameters;
    const signals = [];
    for (const source of sources) {
        if (Array.isArray(source)) {
            if (!Array.isArray(returnValue)) {
                returnValue = [];
            }
            returnValue = [...returnValue, ...source];
        }
        else if (isObject(source)) {
            for (let [key, value] of Object.entries(source)) {
                // Special handling for AbortSignal instances
                if (key === 'signal' && value instanceof globalThis.AbortSignal) {
                    signals.push(value);
                    continue;
                }
                // Special handling for searchParams
                if (key === 'searchParams') {
                    if (value === undefined || value === null) {
                        // Explicit undefined or null removes searchParams
                        searchParameters = undefined;
                    }
                    else {
                        // First source: keep as-is to preserve type (string/object/URLSearchParams)
                        // Subsequent sources: merge and convert to URLSearchParams
                        searchParameters = searchParameters === undefined ? value : appendSearchParameters(searchParameters, value);
                    }
                    continue;
                }
                if (isObject(value) && key in returnValue) {
                    value = deepMerge(returnValue[key], value);
                }
                returnValue = { ...returnValue, [key]: value };
            }
            if (isObject(source.hooks)) {
                hooks = mergeHooks(hooks, source.hooks);
                returnValue.hooks = hooks;
            }
            if (isObject(source.headers)) {
                headers = mergeHeaders(headers, source.headers);
                returnValue.headers = headers;
            }
        }
    }
    if (searchParameters !== undefined) {
        returnValue.searchParams = searchParameters;
    }
    if (signals.length > 0) {
        if (signals.length === 1) {
            returnValue.signal = signals[0];
        }
        else if (supportsAbortSignal) {
            returnValue.signal = AbortSignal.any(signals);
        }
        else {
            // When AbortSignal.any is not available, use the last signal
            // This maintains the previous behavior before signal merging was added
            // This can be remove when the `supportsAbortSignal` check is removed.`
            returnValue.signal = signals.at(-1);
        }
    }
    return returnValue;
};
//# sourceMappingURL=merge.js.map