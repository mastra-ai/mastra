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
    ObjectCoercer: ()=>ObjectCoercer
});
const index_js_namespaceObject = require("../../utils/index.js");
const external_types_js_namespaceObject = require("../types.js");
const external_utils_js_namespaceObject = require("./utils.js");
class ObjectCoercer {
    match(candidate) {
        return 'object' == typeof candidate && null !== candidate;
    }
    coerce(candidate, ctx) {
        const errorProperty = this.getErrorPropertyFromObject(candidate);
        if (errorProperty) return ctx.apply(errorProperty);
        return {
            type: this.getType(candidate),
            value: this.getValue(candidate),
            stack: ctx.syntheticException?.stack,
            level: this.isSeverityLevel(candidate.level) ? candidate.level : 'error',
            synthetic: true
        };
    }
    getType(err) {
        return (0, index_js_namespaceObject.isEvent)(err) ? err.constructor.name : 'Error';
    }
    getValue(err) {
        if ('name' in err && 'string' == typeof err.name) {
            let message = `'${err.name}' captured as exception`;
            if ('message' in err && 'string' == typeof err.message) message += ` with message: '${err.message}'`;
            return message;
        }
        if ('message' in err && 'string' == typeof err.message) return err.message;
        const className = this.getObjectClassName(err);
        const keys = (0, external_utils_js_namespaceObject.extractExceptionKeysForMessage)(err);
        return `${className && 'Object' !== className ? `'${className}'` : 'Object'} captured as exception with keys: ${keys}`;
    }
    isSeverityLevel(x) {
        return (0, index_js_namespaceObject.isString)(x) && !(0, index_js_namespaceObject.isEmptyString)(x) && external_types_js_namespaceObject.severityLevels.indexOf(x) >= 0;
    }
    getErrorPropertyFromObject(obj) {
        for(const prop in obj)if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            const value = obj[prop];
            if ((0, index_js_namespaceObject.isError)(value)) return value;
        }
    }
    getObjectClassName(obj) {
        try {
            const prototype = Object.getPrototypeOf(obj);
            return prototype ? prototype.constructor.name : void 0;
        } catch (e) {
            return;
        }
    }
}
exports.ObjectCoercer = __webpack_exports__.ObjectCoercer;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "ObjectCoercer"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
