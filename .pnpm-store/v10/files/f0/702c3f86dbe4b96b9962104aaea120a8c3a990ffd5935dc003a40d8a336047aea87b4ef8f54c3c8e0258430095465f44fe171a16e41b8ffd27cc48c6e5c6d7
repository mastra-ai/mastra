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
    addUncaughtExceptionListener: ()=>addUncaughtExceptionListener,
    addUnhandledRejectionListener: ()=>addUnhandledRejectionListener
});
function makeUncaughtExceptionHandler(captureFn, onFatalFn) {
    let calledFatalError = false;
    return Object.assign((error)=>{
        const userProvidedListenersCount = global.process.listeners('uncaughtException').filter((listener)=>'domainUncaughtExceptionClear' !== listener.name && true !== listener._posthogErrorHandler).length;
        const processWouldExit = 0 === userProvidedListenersCount;
        captureFn(error, {
            mechanism: {
                type: 'onuncaughtexception',
                handled: false
            }
        });
        if (!calledFatalError && processWouldExit) {
            calledFatalError = true;
            onFatalFn(error);
        }
    }, {
        _posthogErrorHandler: true
    });
}
function addUncaughtExceptionListener(captureFn, onFatalFn) {
    global.process.on('uncaughtException', makeUncaughtExceptionHandler(captureFn, onFatalFn));
}
function addUnhandledRejectionListener(captureFn) {
    global.process.on('unhandledRejection', (reason)=>captureFn(reason, {
            mechanism: {
                type: 'onunhandledrejection',
                handled: false
            }
        }));
}
exports.addUncaughtExceptionListener = __webpack_exports__.addUncaughtExceptionListener;
exports.addUnhandledRejectionListener = __webpack_exports__.addUnhandledRejectionListener;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "addUncaughtExceptionListener",
    "addUnhandledRejectionListener"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
