"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePerOrigin = exports.getByOrigin = exports.RetryError = exports.TimeoutError = exports.AbortError = exports.FetchError = void 0;
class FetchError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, FetchError.prototype);
    }
}
exports.FetchError = FetchError;
class AbortError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, AbortError.prototype);
    }
}
exports.AbortError = AbortError;
class TimeoutError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}
exports.TimeoutError = TimeoutError;
class RetryError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, RetryError.prototype);
    }
}
exports.RetryError = RetryError;
function getByOrigin(val, origin) {
    return typeof val === "function"
        ? val(origin)
        : val;
}
exports.getByOrigin = getByOrigin;
function parsePerOrigin(val, _default) {
    if (val == null) {
        return _default;
    }
    if (typeof val === "function")
        return (origin) => {
            const ret = val(origin);
            if (ret == null)
                return _default;
            return ret;
        };
    return val;
}
exports.parsePerOrigin = parsePerOrigin;
//# sourceMappingURL=core.js.map