"use strict";
var __webpack_require__ = {};
(()=>{
    __webpack_require__.d = (exports1, definition)=>{
        for(var key in definition)if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports1, key)) Object.defineProperty(exports1, key, {
            enumerable: true,
            get: definition[key]
        });
    };
})();
(()=>{
    __webpack_require__.o = (obj, prop)=>Object.prototype.hasOwnProperty.call(obj, prop);
})();
(()=>{
    __webpack_require__.r = (exports1)=>{
        if ('undefined' != typeof Symbol && Symbol.toStringTag) Object.defineProperty(exports1, Symbol.toStringTag, {
            value: 'Module'
        });
        Object.defineProperty(exports1, '__esModule', {
            value: true
        });
    };
})();
var __webpack_exports__ = {};
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
    _createLogger: ()=>_createLogger,
    createLogger: ()=>createLogger
});
function createConsole(consoleLike = console) {
    const lockedMethods = {
        log: consoleLike.log.bind(consoleLike),
        warn: consoleLike.warn.bind(consoleLike),
        error: consoleLike.error.bind(consoleLike),
        debug: consoleLike.debug.bind(consoleLike)
    };
    return lockedMethods;
}
const _createLogger = (prefix, maybeCall, consoleLike)=>{
    function _log(level, ...args) {
        maybeCall(()=>{
            const consoleMethod = consoleLike[level];
            consoleMethod(prefix, ...args);
        });
    }
    const logger = {
        info: (...args)=>{
            _log('log', ...args);
        },
        warn: (...args)=>{
            _log('warn', ...args);
        },
        error: (...args)=>{
            _log('error', ...args);
        },
        critical: (...args)=>{
            consoleLike['error'](prefix, ...args);
        },
        createLogger: (additionalPrefix)=>_createLogger(`${prefix} ${additionalPrefix}`, maybeCall, consoleLike)
    };
    return logger;
};
function createLogger(prefix, maybeCall) {
    return _createLogger(prefix, maybeCall, createConsole());
}
exports._createLogger = __webpack_exports__._createLogger;
exports.createLogger = __webpack_exports__.createLogger;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "_createLogger",
    "createLogger"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
