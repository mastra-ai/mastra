/*!
 * Copyright 2017 Google Inc. All Rights Reserved.
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
/*!
 * The default initial backoff time in milliseconds after an error.
 * Set to 1s according to https://cloud.google.com/apis/design/errors.
 */
export declare const DEFAULT_BACKOFF_INITIAL_DELAY_MS = 1000;
/*!
 * The default maximum backoff time in milliseconds.
 */
export declare const DEFAULT_BACKOFF_MAX_DELAY_MS: number;
/*!
 * The default factor to increase the backup by after each failed attempt.
 */
export declare const DEFAULT_BACKOFF_FACTOR = 1.5;
/*!
 * The maximum number of retries that will be attempted by backoff
 * before stopping all retry attempts.
 */
export declare const MAX_RETRY_ATTEMPTS = 10;
/*!
 * The timeout handler used by `ExponentialBackoff` and `BulkWriter`.
 */
export declare let delayExecution: (f: () => void, ms: number) => NodeJS.Timeout;
/**
 * Allows overriding of the timeout handler used by the exponential backoff
 * implementation. If not invoked, we default to `setTimeout()`.
 *
 * Used only in testing.
 *
 * @private
 * @internal
 * @param {function} handler A handler than matches the API of `setTimeout()`.
 */
export declare function setTimeoutHandler(handler: (f: () => void, ms: number) => void): void;
/**
 * Configuration object to adjust the delays of the exponential backoff
 * algorithm.
 *
 * @private
 * @internal
 */
export interface ExponentialBackoffSetting {
    /** Optional override for the initial retry delay. */
    initialDelayMs?: number;
    /** Optional override for the exponential backoff factor. */
    backoffFactor?: number;
    /** Optional override for the maximum retry delay. */
    maxDelayMs?: number;
    /**
     * Optional override to control the itter factor by which to randomize
     * attempts (0 means no randomization, 1.0 means +/-50% randomization). It is
     * suggested not to exceed this range.
     */
    jitterFactor?: number;
}
/**
 * A helper for running delayed tasks following an exponential backoff curve
 * between attempts.
 *
 * Each delay is made up of a "base" delay which follows the exponential
 * backoff curve, and a "jitter" (+/- 50% by default)  that is calculated and
 * added to the base delay. This prevents clients from accidentally
 * synchronizing their delays causing spikes of load to the backend.
 *
 * @private
 * @internal
 */
export declare class ExponentialBackoff {
    /**
     * The initial delay (used as the base delay on the first retry attempt).
     * Note that jitter will still be applied, so the actual delay could be as
     * little as 0.5*initialDelayMs (based on a jitter factor of 1.0).
     *
     * @private
     * @internal
     */
    private readonly initialDelayMs;
    /**
     * The multiplier to use to determine the extended base delay after each
     * attempt.
     *
     * @private
     * @internal
     */
    private readonly backoffFactor;
    /**
     * The maximum base delay after which no further backoff is performed.
     * Note that jitter will still be applied, so the actual delay could be as
     * much as 1.5*maxDelayMs (based on a jitter factor of 1.0).
     *
     * @private
     * @internal
     */
    private readonly maxDelayMs;
    /**
     * The jitter factor that controls the random distribution of the backoff
     * points.
     *
     * @private
     * @internal
     */
    private readonly jitterFactor;
    /**
     * The number of retries that has been attempted.
     *
     * @private
     * @internal
     */
    private _retryCount;
    /**
     * The backoff delay of the current attempt.
     *
     * @private
     * @internal
     */
    private currentBaseMs;
    /**
     * Whether we are currently waiting for backoff to complete.
     *
     * @private
     * @internal
     */
    private awaitingBackoffCompletion;
    constructor(options?: ExponentialBackoffSetting);
    /**
     * Resets the backoff delay and retry count.
     *
     * The very next backoffAndWait() will have no delay. If it is called again
     * (i.e. due to an error), initialDelayMs (plus jitter) will be used, and
     * subsequent ones will increase according to the backoffFactor.
     *
     * @private
     * @internal
     */
    reset(): void;
    /**
     * Resets the backoff delay to the maximum delay (e.g. for use after a
     * RESOURCE_EXHAUSTED error).
     *
     * @private
     * @internal
     */
    resetToMax(): void;
    /**
     * Returns a promise that resolves after currentDelayMs, and increases the
     * delay for any subsequent attempts.
     *
     * @return A Promise that resolves when the current delay elapsed.
     * @private
     * @internal
     */
    backoffAndWait(): Promise<void>;
    get retryCount(): number;
    /**
     * Returns a randomized "jitter" delay based on the current base and jitter
     * factor.
     *
     * @returns {number} The jitter to apply based on the current delay.
     * @private
     * @internal
     */
    private jitterDelayMs;
}
