'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncGuard = exports.syncGuard = void 0;
function handle(handler, err, stacks) {
    try {
        const handledErr = stacks.length === 0 ? err : Object.create(err);
        if (stacks.length > 0) {
            handledErr.stack =
                [...stacks, err.stack]
                    .join("\nFrom:\n")
                    .replace("\n\n", "\n");
        }
        try {
            handler(handledErr);
        }
        catch (err) {
            console.error("[callguard 1/2]: guard handler threw error", err);
            console.error("[callguard 2/2]: while handling", handledErr);
        }
    }
    catch (err) {
        console.error("[callguard] handle error (probably caused by non-Error throw)]", err);
    }
}
function syncGuard(handler, opts) {
    const captureCallstacks = opts && !!opts.longStackTraces;
    const defaultReturn = (opts && opts.defaultReturn != null)
        ? opts.defaultReturn
        : null;
    const stacks = [];
    return function (fn) {
        if (captureCallstacks)
            stacks.push((new Error("[callguard]")).stack);
        return function (...args) {
            if (captureCallstacks)
                stacks.push((new Error("[callguard]")).stack);
            try {
                const ret = fn(...args);
                if (opts && opts.catchAsync) {
                    Promise.resolve(ret)
                        .catch(err => handle(handler, err, stacks));
                }
                return ret;
            }
            catch (err) {
                handle(handler, err, stacks);
                return defaultReturn;
            }
        };
    };
}
exports.syncGuard = syncGuard;
function asyncGuard(handler, opts) {
    const captureCallstacks = opts && !!opts.longStackTraces;
    const defaultReturn = (opts && opts.defaultReturn != null)
        ? opts.defaultReturn
        : null;
    const stacks = [];
    return function (fn) {
        if (captureCallstacks)
            stacks.push((new Error("[callguard]")).stack);
        return function (...args) {
            if (captureCallstacks)
                stacks.push((new Error("[callguard]")).stack);
            try {
                return Promise.resolve(fn(...args))
                    .catch(err => {
                    handle(handler, err, stacks);
                    return defaultReturn;
                });
            }
            catch (err) {
                handle(handler, err, stacks);
                return defaultReturn;
            }
        };
    };
}
exports.asyncGuard = asyncGuard;
