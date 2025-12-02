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
    BucketedRateLimiter: ()=>BucketedRateLimiter
});
const external_number_utils_js_namespaceObject = require("./number-utils.js");
const ONE_DAY_IN_MS = 86400000;
class BucketedRateLimiter {
    constructor(options){
        this._buckets = {};
        this._onBucketRateLimited = options._onBucketRateLimited;
        this._bucketSize = (0, external_number_utils_js_namespaceObject.clampToRange)(options.bucketSize, 0, 100, options._logger);
        this._refillRate = (0, external_number_utils_js_namespaceObject.clampToRange)(options.refillRate, 0, this._bucketSize, options._logger);
        this._refillInterval = (0, external_number_utils_js_namespaceObject.clampToRange)(options.refillInterval, 0, ONE_DAY_IN_MS, options._logger);
    }
    _applyRefill(bucket, now) {
        const elapsedMs = now - bucket.lastAccess;
        const refillIntervals = Math.floor(elapsedMs / this._refillInterval);
        if (refillIntervals > 0) {
            const tokensToAdd = refillIntervals * this._refillRate;
            bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this._bucketSize);
            bucket.lastAccess = bucket.lastAccess + refillIntervals * this._refillInterval;
        }
    }
    consumeRateLimit(key) {
        const now = Date.now();
        const keyStr = String(key);
        let bucket = this._buckets[keyStr];
        if (bucket) this._applyRefill(bucket, now);
        else {
            bucket = {
                tokens: this._bucketSize,
                lastAccess: now
            };
            this._buckets[keyStr] = bucket;
        }
        if (0 === bucket.tokens) return true;
        bucket.tokens--;
        if (0 === bucket.tokens) this._onBucketRateLimited?.(key);
        return 0 === bucket.tokens;
    }
    stop() {
        this._buckets = {};
    }
}
exports.BucketedRateLimiter = __webpack_exports__.BucketedRateLimiter;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "BucketedRateLimiter"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
