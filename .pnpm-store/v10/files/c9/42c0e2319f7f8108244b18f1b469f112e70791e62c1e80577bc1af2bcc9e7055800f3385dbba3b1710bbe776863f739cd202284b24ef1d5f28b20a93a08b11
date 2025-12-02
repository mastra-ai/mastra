/**
 * A helper that uses the Token Bucket algorithm to rate limit the number of
 * operations that can be made in a second.
 *
 * Before a given request containing a number of operations can proceed,
 * RateLimiter determines doing so stays under the provided rate limits. It can
 * also determine how much time is required before a request can be made.
 *
 * RateLimiter can also implement a gradually increasing rate limit. This is
 * used to enforce the 500/50/5 rule
 * (https://firebase.google.com/docs/firestore/best-practices#ramping_up_traffic).
 *
 * @private
 * @internal
 */
export declare class RateLimiter {
    private readonly initialCapacity;
    private readonly multiplier;
    private readonly multiplierMillis;
    readonly maximumCapacity: number;
    private readonly startTimeMillis;
    availableTokens: number;
    lastRefillTimeMillis: number;
    previousCapacity: number;
    /**
     * @param initialCapacity Initial maximum number of operations per second.
     * @param multiplier Rate by which to increase the capacity.
     * @param multiplierMillis How often the capacity should increase in
     * milliseconds.
     * @param maximumCapacity Maximum number of allowed operations per second.
     * The number of tokens added per second will never exceed this number.
     * @param startTimeMillis The starting time in epoch milliseconds that the
     * rate limit is based on. Used for testing the limiter.
     */
    constructor(initialCapacity: number, multiplier: number, multiplierMillis: number, maximumCapacity: number, startTimeMillis?: number);
    /**
     * Tries to make the number of operations. Returns true if the request
     * succeeded and false otherwise.
     *
     * @param requestTimeMillis The time used to calculate the number of available
     * tokens. Used for testing the limiter.
     * @private
     * @internal
     */
    tryMakeRequest(numOperations: number, requestTimeMillis?: number): boolean;
    /**
     * Returns the number of ms needed to make a request with the provided number
     * of operations. Returns 0 if the request can be made with the existing
     * capacity. Returns -1 if the request is not possible with the current
     * capacity.
     *
     * @param requestTimeMillis The time used to calculate the number of available
     * tokens. Used for testing the limiter.
     * @private
     * @internal
     */
    getNextRequestDelayMs(numOperations: number, requestTimeMillis?: number): number;
    /**
     * Refills the number of available tokens based on how much time has elapsed
     * since the last time the tokens were refilled.
     *
     * @param requestTimeMillis The time used to calculate the number of available
     * tokens. Used for testing the limiter.
     * @private
     * @internal
     */
    private refillTokens;
    /**
     * Calculates the maximum capacity based on the provided date.
     *
     * @private
     * @internal
     */
    calculateCapacity(requestTimeMillis: number): number;
}
