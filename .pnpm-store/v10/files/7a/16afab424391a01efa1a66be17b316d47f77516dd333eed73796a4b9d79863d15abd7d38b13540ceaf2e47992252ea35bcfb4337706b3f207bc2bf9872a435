"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
/*!
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const assert = require("assert");
const logger_1 = require("./logger");
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
class RateLimiter {
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
    constructor(initialCapacity, multiplier, multiplierMillis, maximumCapacity, startTimeMillis = Date.now()) {
        this.initialCapacity = initialCapacity;
        this.multiplier = multiplier;
        this.multiplierMillis = multiplierMillis;
        this.maximumCapacity = maximumCapacity;
        this.startTimeMillis = startTimeMillis;
        this.availableTokens = initialCapacity;
        this.lastRefillTimeMillis = startTimeMillis;
        this.previousCapacity = initialCapacity;
    }
    /**
     * Tries to make the number of operations. Returns true if the request
     * succeeded and false otherwise.
     *
     * @param requestTimeMillis The time used to calculate the number of available
     * tokens. Used for testing the limiter.
     * @private
     * @internal
     */
    tryMakeRequest(numOperations, requestTimeMillis = Date.now()) {
        this.refillTokens(requestTimeMillis);
        if (numOperations <= this.availableTokens) {
            this.availableTokens -= numOperations;
            return true;
        }
        return false;
    }
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
    getNextRequestDelayMs(numOperations, requestTimeMillis = Date.now()) {
        this.refillTokens(requestTimeMillis);
        if (numOperations < this.availableTokens) {
            return 0;
        }
        const capacity = this.calculateCapacity(requestTimeMillis);
        if (capacity < numOperations) {
            return -1;
        }
        const requiredTokens = numOperations - this.availableTokens;
        return Math.ceil((requiredTokens * 1000) / capacity);
    }
    /**
     * Refills the number of available tokens based on how much time has elapsed
     * since the last time the tokens were refilled.
     *
     * @param requestTimeMillis The time used to calculate the number of available
     * tokens. Used for testing the limiter.
     * @private
     * @internal
     */
    refillTokens(requestTimeMillis) {
        if (requestTimeMillis >= this.lastRefillTimeMillis) {
            const elapsedTime = requestTimeMillis - this.lastRefillTimeMillis;
            const capacity = this.calculateCapacity(requestTimeMillis);
            const tokensToAdd = Math.floor((elapsedTime * capacity) / 1000);
            if (tokensToAdd > 0) {
                this.availableTokens = Math.min(capacity, this.availableTokens + tokensToAdd);
                this.lastRefillTimeMillis = requestTimeMillis;
            }
        }
        else {
            throw new Error('Request time should not be before the last token refill time.');
        }
    }
    /**
     * Calculates the maximum capacity based on the provided date.
     *
     * @private
     * @internal
     */
    // Visible for testing.
    calculateCapacity(requestTimeMillis) {
        assert(requestTimeMillis >= this.startTimeMillis, 'startTime cannot be after currentTime');
        const millisElapsed = requestTimeMillis - this.startTimeMillis;
        const operationsPerSecond = Math.min(Math.floor(Math.pow(this.multiplier, Math.floor(millisElapsed / this.multiplierMillis)) * this.initialCapacity), this.maximumCapacity);
        if (operationsPerSecond !== this.previousCapacity) {
            (0, logger_1.logger)('RateLimiter.calculateCapacity', null, `New request capacity: ${operationsPerSecond} operations per second.`);
        }
        this.previousCapacity = operationsPerSecond;
        return operationsPerSecond;
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rate-limiter.js.map