import pRetry from "p-retry";
import PQueueMod from "p-queue";
const STATUS_RETRYABLE = [
    408, // Request Timeout
    425, // Too Early
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
];
/**
 * A class that can be used to make async calls with concurrency and retry logic.
 *
 * This is useful for making calls to any kind of "expensive" external resource,
 * be it because it's rate-limited, subject to network issues, etc.
 *
 * Concurrent calls are limited by the `maxConcurrency` parameter, which defaults
 * to `Infinity`. This means that by default, all calls will be made in parallel.
 *
 * Retries are limited by the `maxRetries` parameter, which defaults to 6. This
 * means that by default, each call will be retried up to 6 times, with an
 * exponential backoff between each attempt.
 */
export class AsyncCaller {
    constructor(params) {
        Object.defineProperty(this, "maxConcurrency", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxRetries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxQueueSizeBytes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "queue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onFailedResponseHook", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "queueSizeBytes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.maxConcurrency = params.maxConcurrency ?? Infinity;
        this.maxRetries = params.maxRetries ?? 6;
        this.maxQueueSizeBytes = params.maxQueueSizeBytes;
        if ("default" in PQueueMod) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.queue = new PQueueMod.default({
                concurrency: this.maxConcurrency,
            });
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.queue = new PQueueMod({ concurrency: this.maxConcurrency });
        }
        this.onFailedResponseHook = params?.onFailedResponseHook;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call(callable, ...args) {
        return this.callWithOptions({}, callable, ...args);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callWithOptions(options, callable, ...args) {
        const sizeBytes = options.sizeBytes ?? 0;
        // Check if adding this call would exceed the byte size limit
        if (this.maxQueueSizeBytes !== undefined &&
            sizeBytes > 0 &&
            this.queueSizeBytes + sizeBytes > this.maxQueueSizeBytes) {
            return Promise.reject(new Error(`Queue size limit (${this.maxQueueSizeBytes} bytes) exceeded. ` +
                `Current queue size: ${this.queueSizeBytes} bytes, attempted addition: ${sizeBytes} bytes.`));
        }
        // Add to queue size tracking
        if (sizeBytes > 0) {
            this.queueSizeBytes += sizeBytes;
        }
        const onFailedResponseHook = this.onFailedResponseHook;
        let promise = this.queue.add(() => pRetry(() => callable(...args).catch((error) => {
            // eslint-disable-next-line no-instanceof/no-instanceof
            if (error instanceof Error) {
                throw error;
            }
            else {
                throw new Error(error);
            }
        }), {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async onFailedAttempt(error) {
                if (error.message.startsWith("Cancel") ||
                    error.message.startsWith("TimeoutError") ||
                    error.name === "TimeoutError" ||
                    error.message.startsWith("AbortError")) {
                    throw error;
                }
                if (error?.code === "ECONNABORTED") {
                    throw error;
                }
                const response = error?.response;
                if (onFailedResponseHook) {
                    const handled = await onFailedResponseHook(response);
                    if (handled) {
                        return;
                    }
                }
                const status = response?.status ?? error?.status;
                if (status) {
                    if (!STATUS_RETRYABLE.includes(+status)) {
                        throw error;
                    }
                }
            },
            retries: this.maxRetries,
            randomize: true,
        }), { throwOnTimeout: true });
        // Decrement queue size when the call completes (success or failure)
        if (sizeBytes > 0) {
            promise = promise.finally(() => {
                this.queueSizeBytes -= sizeBytes;
            });
        }
        // Handle signal cancellation
        if (options.signal) {
            return Promise.race([
                promise,
                new Promise((_, reject) => {
                    options.signal?.addEventListener("abort", () => {
                        reject(new Error("AbortError"));
                    });
                }),
            ]);
        }
        return promise;
    }
}
