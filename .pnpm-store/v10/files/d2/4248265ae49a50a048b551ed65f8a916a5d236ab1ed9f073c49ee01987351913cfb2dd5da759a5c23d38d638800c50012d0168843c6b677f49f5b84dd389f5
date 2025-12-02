export declare enum PromiseState {
    None = 0,
    Resolved = 1,
    Rejected = 2
}
export interface IDeferred<T> {
    readonly promise: Promise<T>;
    resolve(result: T): IDeferred<T>;
    reject(error: string): IDeferred<T>;
}
export declare class PromiseResult<T> {
    protected privIsCompleted: boolean;
    protected privIsError: boolean;
    protected privError: string;
    protected privResult: T;
    constructor(promiseResultEventSource: PromiseResultEventSource<T>);
    get isCompleted(): boolean;
    get isError(): boolean;
    get error(): string;
    get result(): T;
    throwIfError: () => void;
}
export declare class PromiseResultEventSource<T> {
    private privOnSetResult;
    private privOnSetError;
    setResult: (result: T) => void;
    setError: (error: string) => void;
    on: (onSetResult: (result: T) => void, onSetError: (error: string) => void) => void;
}
export declare class Deferred<T> implements IDeferred<T> {
    private privPromise;
    private privResolve;
    private privReject;
    constructor();
    get promise(): Promise<T>;
    resolve: (result: T | Promise<T>) => Deferred<T>;
    reject: (error: string) => Deferred<T>;
}
export declare class Sink<T> {
    private privState;
    private privPromiseResult;
    private privPromiseResultEvents;
    private privSuccessHandlers;
    private privErrorHandlers;
    constructor();
    get state(): PromiseState;
    get result(): PromiseResult<T>;
    resolve(result: T): void;
    reject(error: string): void;
    on(successCallback: (result: T) => void, errorCallback: (error: string) => void): void;
    private executeSuccessCallback;
    private executeErrorCallback;
    private detachHandlers;
}
export declare function marshalPromiseToCallbacks<T>(promise: Promise<T>, cb?: (value: T) => void, err?: (error: string) => void): void;
