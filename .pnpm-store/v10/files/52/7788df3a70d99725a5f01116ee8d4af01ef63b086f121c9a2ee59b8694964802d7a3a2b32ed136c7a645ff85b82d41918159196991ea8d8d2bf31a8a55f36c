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
    EventCoercer: ()=>EventCoercer
});
const index_js_namespaceObject = require("../../utils/index.js");
const external_utils_js_namespaceObject = require("./utils.js");
class EventCoercer {
    match(err) {
        return (0, index_js_namespaceObject.isEvent)(err);
    }
    coerce(evt, ctx) {
        const constructorName = evt.constructor.name;
        return {
            type: constructorName,
            value: `${constructorName} captured as exception with keys: ${(0, external_utils_js_namespaceObject.extractExceptionKeysForMessage)(evt)}`,
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
    }
}
exports.EventCoercer = __webpack_exports__.EventCoercer;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "EventCoercer"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
