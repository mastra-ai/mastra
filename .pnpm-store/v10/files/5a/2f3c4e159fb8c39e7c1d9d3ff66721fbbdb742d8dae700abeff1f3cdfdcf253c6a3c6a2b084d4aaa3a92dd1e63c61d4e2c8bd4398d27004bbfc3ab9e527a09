/**
 * Run the function `func` with an `AbortSignal` that will automatically abort after the time specified
 * by `timeout` or when the given `signal` is aborted.
 *
 * On timeout, the `timeoutSignal` will be aborted and a `TimeoutError` will be thrown.
 */
export declare function withTimeout<T>(timeout: number, func: (timeoutSignal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T>;
