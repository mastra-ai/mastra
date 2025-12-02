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
    StringCoercer: ()=>StringCoercer
});
const ERROR_TYPES_PATTERN = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;
class StringCoercer {
    match(input) {
        return 'string' == typeof input;
    }
    coerce(input, ctx) {
        const [type, value] = this.getInfos(input);
        return {
            type: type ?? 'Error',
            value: value ?? input,
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
    }
    getInfos(candidate) {
        let type = 'Error';
        let value = candidate;
        const groups = candidate.match(ERROR_TYPES_PATTERN);
        if (groups) {
            type = groups[1];
            value = groups[2];
        }
        return [
            type,
            value
        ];
    }
}
exports.StringCoercer = __webpack_exports__.StringCoercer;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "StringCoercer"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
