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
    DOMExceptionCoercer: ()=>DOMExceptionCoercer
});
const index_js_namespaceObject = require("../../utils/index.js");
class DOMExceptionCoercer {
    match(err) {
        return this.isDOMException(err) || this.isDOMError(err);
    }
    coerce(err, ctx) {
        const hasStack = (0, index_js_namespaceObject.isString)(err.stack);
        return {
            type: this.getType(err),
            value: this.getValue(err),
            stack: hasStack ? err.stack : void 0,
            cause: err.cause ? ctx.next(err.cause) : void 0,
            synthetic: false
        };
    }
    getType(candidate) {
        return this.isDOMError(candidate) ? 'DOMError' : 'DOMException';
    }
    getValue(err) {
        const name = err.name || (this.isDOMError(err) ? 'DOMError' : 'DOMException');
        const message = err.message ? `${name}: ${err.message}` : name;
        return message;
    }
    isDOMException(err) {
        return (0, index_js_namespaceObject.isBuiltin)(err, 'DOMException');
    }
    isDOMError(err) {
        return (0, index_js_namespaceObject.isBuiltin)(err, 'DOMError');
    }
}
exports.DOMExceptionCoercer = __webpack_exports__.DOMExceptionCoercer;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "DOMExceptionCoercer"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
