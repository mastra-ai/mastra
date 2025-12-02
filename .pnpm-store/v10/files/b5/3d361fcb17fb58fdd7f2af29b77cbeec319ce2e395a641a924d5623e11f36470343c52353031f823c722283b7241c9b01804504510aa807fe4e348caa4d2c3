type Milliseconds = number;
type RetryOptions = Partial<{
    /**
     * The initial delay before the first retry.
     *
     * @default 125
     */
    initialDelay: Milliseconds;
    /**
     * The maximum delay between retries.
     * The delay between retries will never exceed this value.
     * If set to 0, the delay will increase indefinitely.
     *
     * @default 0
     */
    maxDelayBetweenRetries: Milliseconds;
    /**
     * The multiplier for the exponential backoff.
     *
     * @default 2
     */
    factor: number;
    /**
     * A function to determine if the operation should be retried.
     * The callback accepts the error that was thrown and the number of iterations.
     * The iterations variable references the number of retries AFTER attempt
     * that caused the error and starts at 1 (as in, this is the 1st, 2nd, nth retry).
     *
     * @default (error, iterations) => iterations < 5
     */
    shouldRetry: (error: unknown, iterations: number) => boolean;
    /**
     * Controls whether the helper should retry the operation immediately once before applying exponential backoff.
     * The delay for the immediate retry is 100ms.
     *
     * @default false
     */
    retryImmediately: boolean;
    /**
     * If true, the intervals will be multiplied by a factor in the range of [1,2].
     *
     * @default true
     */
    jitter: boolean;
    /**
     * A callback that is invoked before each retry attempt.
     * The callback receives the iteration number (starting from 1 for the first retry).
     * This can be used to modify request parameters, add headers, etc.
     */
    onBeforeRetry?: (iteration: number) => void | Promise<void>;
}>;
/**
 * Retries a callback until it succeeds or the shouldRetry function returns false.
 * See {@link RetryOptions} for the available options.
 */
declare const retry: <T>(callback: () => T | Promise<T>, options?: RetryOptions) => Promise<T>;

export { retry };
