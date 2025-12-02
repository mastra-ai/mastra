import { Logger } from '../types';
export declare class BucketedRateLimiter<T extends string | number> {
    private _bucketSize;
    private _refillRate;
    private _refillInterval;
    private _onBucketRateLimited?;
    private _buckets;
    constructor(options: {
        bucketSize: number;
        refillRate: number;
        refillInterval: number;
        _logger: Logger;
        _onBucketRateLimited?: (key: T) => void;
    });
    private _applyRefill;
    consumeRateLimit(key: T): boolean;
    stop(): void;
}
//# sourceMappingURL=bucketed-rate-limiter.d.ts.map