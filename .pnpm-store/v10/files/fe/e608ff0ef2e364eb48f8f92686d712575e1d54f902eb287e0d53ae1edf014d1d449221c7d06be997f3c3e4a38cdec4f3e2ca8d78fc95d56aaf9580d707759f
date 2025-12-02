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
    ReduceableCache: ()=>ReduceableCache
});
class ReduceableCache {
    constructor(_maxSize){
        this._maxSize = _maxSize;
        this._cache = new Map();
    }
    get(key) {
        const value = this._cache.get(key);
        if (void 0 === value) return;
        this._cache.delete(key);
        this._cache.set(key, value);
        return value;
    }
    set(key, value) {
        this._cache.set(key, value);
    }
    reduce() {
        while(this._cache.size >= this._maxSize){
            const value = this._cache.keys().next().value;
            if (value) this._cache.delete(value);
        }
    }
}
exports.ReduceableCache = __webpack_exports__.ReduceableCache;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "ReduceableCache"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
