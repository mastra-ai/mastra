import { Duration } from './temporal';
/**
 * This interface specifies what we'll add to retried items in order
 * to track them through the exponential backoff.
 *
 * @private
 */
export interface RetriedItem<T> {
    retryInfo?: RetryInfo<T>;
}
/**
 * These items will go inside the added retry metadata.
 *
 * @private
 */
export interface RetryInfo<T> {
    firstRetry: number;
    nextRetry: number;
    multiplier: number;
    callback: RetryCallback<T>;
}
/**
 * Users of this class will pass in a callback in this form when
 * an item is ready to be retried. The item must be placed
 * back on the queue if it needs to be retried again.
 *
 * @private
 */
export interface RetryCallback<T> {
    (item: T, totalTime: Duration): void;
}
/**
 * Provides a helper that will manage your retries using the "truncated
 * exponential backoff" strategy.
 *
 * Most of the pieces of this library are doing retries via gax, but for
 * exactly-once delivery, we have some things where gRPC failures won't
 * take care of it.
 *
 * @private
 */
export declare class ExponentialRetry<T> {
    private _items;
    private _backoffMs;
    private _maxBackoffMs;
    private _timer?;
    constructor(backoff: Duration, maxBackoff: Duration);
    /**
     * Shut down all operations/timers/etc and return a list of
     * items that were still pending retry.
     *
     * @private
     */
    close(): T[];
    /**
     * Place an item on the retry queue. It's important that it's the
     * same exact item that was already on the queue, if it's being retried
     * more than once.
     *
     * @private
     */
    retryLater(item: T, callback: RetryCallback<T>): void;
    /**
     * Resets an item that was previously retried. This is useful if you have
     * persistent items that just need to be retried occasionally.
     *
     * @private
     */
    reset(item: T): void;
    private randomizeDelta;
    private doRetries;
    private scheduleRetry;
}
