/**
 * Delayed promise. It is only constructed once the value is accessed.
 * This is useful to avoid unhandled promise rejections when the promise is created
 * but not accessed.
 */
export declare class DelayedPromise<T> {
    status: {
        type: 'pending';
    } | {
        type: 'resolved';
        value: T;
    } | {
        type: 'rejected';
        error: unknown;
    };
    private _promise;
    private _resolve;
    private _reject;
    get promise(): Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
}
//# sourceMappingURL=delayed-promise.d.ts.map