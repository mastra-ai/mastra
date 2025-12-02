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
    ErrorCoercer: ()=>ErrorCoercer
});
const index_js_namespaceObject = require("../../utils/index.js");
class ErrorCoercer {
    match(err) {
        return (0, index_js_namespaceObject.isPlainError)(err);
    }
    coerce(err, ctx) {
        return {
            type: this.getType(err),
            value: this.getMessage(err, ctx),
            stack: this.getStack(err),
            cause: err.cause ? ctx.next(err.cause) : void 0,
            synthetic: false
        };
    }
    getType(err) {
        return err.name || err.constructor.name;
    }
    getMessage(err, _ctx) {
        const message = err.message;
        if (message.error && 'string' == typeof message.error.message) return String(message.error.message);
        return String(message);
    }
    getStack(err) {
        return err.stacktrace || err.stack || void 0;
    }
}
exports.ErrorCoercer = __webpack_exports__.ErrorCoercer;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "ErrorCoercer"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
