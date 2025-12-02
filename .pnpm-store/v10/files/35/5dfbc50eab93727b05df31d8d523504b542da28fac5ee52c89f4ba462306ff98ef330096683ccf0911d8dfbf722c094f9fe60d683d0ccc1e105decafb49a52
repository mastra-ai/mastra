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
    PromiseRejectionEventCoercer: ()=>PromiseRejectionEventCoercer
});
const index_js_namespaceObject = require("../../utils/index.js");
class PromiseRejectionEventCoercer {
    match(err) {
        return (0, index_js_namespaceObject.isBuiltin)(err, 'PromiseRejectionEvent');
    }
    coerce(err, ctx) {
        const reason = this.getUnhandledRejectionReason(err);
        if ((0, index_js_namespaceObject.isPrimitive)(reason)) return {
            type: 'UnhandledRejection',
            value: `Non-Error promise rejection captured with value: ${String(reason)}`,
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
        return ctx.apply(reason);
    }
    getUnhandledRejectionReason(error) {
        if ((0, index_js_namespaceObject.isPrimitive)(error)) return error;
        try {
            if ('reason' in error) return error.reason;
            if ('detail' in error && 'reason' in error.detail) return error.detail.reason;
        } catch  {}
        return error;
    }
}
exports.PromiseRejectionEventCoercer = __webpack_exports__.PromiseRejectionEventCoercer;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "PromiseRejectionEventCoercer"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
