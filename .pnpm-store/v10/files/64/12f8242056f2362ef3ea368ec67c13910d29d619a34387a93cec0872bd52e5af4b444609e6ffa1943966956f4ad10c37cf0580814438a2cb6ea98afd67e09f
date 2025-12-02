import { clampToRange } from "./number-utils.mjs";
const ONE_DAY_IN_MS = 86400000;
class BucketedRateLimiter {
    constructor(options){
        this._buckets = {};
        this._onBucketRateLimited = options._onBucketRateLimited;
        this._bucketSize = clampToRange(options.bucketSize, 0, 100, options._logger);
        this._refillRate = clampToRange(options.refillRate, 0, this._bucketSize, options._logger);
        this._refillInterval = clampToRange(options.refillInterval, 0, ONE_DAY_IN_MS, options._logger);
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
export { BucketedRateLimiter };
