export type RetryOptions = {
    /**
    The number of times to retry failed requests.

    @default 2
    */
    limit?: number;
    /**
    The HTTP methods allowed to retry.

    @default ['get', 'put', 'head', 'delete', 'options', 'trace']
    */
    methods?: string[];
    /**
    The HTTP status codes allowed to retry.

    @default [408, 413, 429, 500, 502, 503, 504]
    */
    statusCodes?: number[];
    /**
    The HTTP status codes allowed to retry with a `Retry-After` header.

    @default [413, 429, 503]
    */
    afterStatusCodes?: number[];
    /**
    If the `Retry-After` header is greater than `maxRetryAfter`, the request will be canceled.

    @default Infinity
    */
    maxRetryAfter?: number;
    /**
    The upper limit of the delay per retry in milliseconds.
    To clamp the delay, set `backoffLimit` to 1000, for example.

    By default, the delay is calculated in the following way:

    ```
    0.3 * (2 ** (attemptCount - 1)) * 1000
    ```

    The delay increases exponentially.

    @default Infinity
    */
    backoffLimit?: number;
    /**
    A function to calculate the delay between retries given `attemptCount` (starts from 1).

    @default attemptCount => 0.3 * (2 ** (attemptCount - 1)) * 1000
    */
    delay?: (attemptCount: number) => number;
};
