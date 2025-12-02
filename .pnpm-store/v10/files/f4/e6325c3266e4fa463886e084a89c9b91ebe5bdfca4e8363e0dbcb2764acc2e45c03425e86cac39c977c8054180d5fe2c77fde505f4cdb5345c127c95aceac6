"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickHouseError = void 0;
exports.parseError = parseError;
exports.getCurrentStackTrace = getCurrentStackTrace;
exports.enhanceStackTrace = enhanceStackTrace;
const errorRe = /(Code|Error): (?<code>\d+).*Exception: (?<message>.+)\((?<type>(?=.+[A-Z]{3})[A-Z0-9_]+?)\)/s;
/** An error that is thrown by the ClickHouse server. */
class ClickHouseError extends Error {
    constructor({ message, code, type }) {
        super(message);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.code = code;
        this.type = type;
        // Set the prototype explicitly, see:
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, ClickHouseError.prototype);
    }
}
exports.ClickHouseError = ClickHouseError;
function parseError(input) {
    const inputIsError = input instanceof Error;
    const message = inputIsError ? input.message : input;
    const match = message.match(errorRe);
    const groups = match?.groups;
    if (groups) {
        return new ClickHouseError(groups);
    }
    else {
        return inputIsError ? input : new Error(input);
    }
}
/** Captures the current stack trace from the sync context before going async.
 *  It is necessary since the majority of the stack trace is lost when an async callback is called. */
function getCurrentStackTrace() {
    const stack = new Error().stack;
    if (!stack)
        return '';
    // Skip the first three lines of the stack trace, containing useless information
    // - Text `Error`
    // - Info about this function call
    // - Info about the originator of this function call, e.g., `request`
    // Additionally, the original stack trace is, in fact, reversed.
    return stack.split('\n').slice(3).reverse().join('\n');
}
/** Having the stack trace produced by the {@link getCurrentStackTrace} function,
 *  add it to an arbitrary error stack trace. No-op if there is no additional stack trace to add.
 *  It could happen if this feature was disabled due to its performance overhead. */
function enhanceStackTrace(err, stackTrace) {
    if (err.stack && stackTrace) {
        const firstNewlineIndex = err.stack.indexOf('\n');
        const firstLine = err.stack.substring(0, firstNewlineIndex);
        const errStack = err.stack.substring(firstNewlineIndex + 1);
        err.stack = `${firstLine}\n${stackTrace}\n${errStack}`;
    }
    return err;
}
//# sourceMappingURL=error.js.map