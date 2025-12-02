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
    hashSHA1: ()=>hashSHA1
});
async function hashSHA1(text) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('SubtleCrypto API not available');
    const hashBuffer = await subtle.digest('SHA-1', new TextEncoder().encode(text));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte)=>byte.toString(16).padStart(2, '0')).join('');
}
exports.hashSHA1 = __webpack_exports__.hashSHA1;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "hashSHA1"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
