/// <reference types="node" />
import EventEmitter from 'events';
/**
 * @internal
 */
type ListenerFunc = (...args: any[]) => void;
/**
 * @internal
 */
interface PromisifyEmitter {
    on(eventName: string | symbol, listener: ListenerFunc): void;
}
/**
 * @internal
 */
type PromisifyFunc<T> = (emitter: PromisifyEmitter, resolve: (result: T) => void, reject: (err: Error) => void) => void;
/**
 * @internal
 */
export declare class StreamablePromise<T> extends EventEmitter implements Promise<T> {
    private _promise;
    private _promiseOns;
    /**
     * @internal
     */
    constructor(promisefyFn: PromisifyFunc<T>);
    private get promise();
    private _depromisify;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
    addListener(eventName: string | symbol, listener: ListenerFunc): this;
    on(eventName: string | symbol, listener: ListenerFunc): this;
    /**
     * @internal
     */
    get [Symbol.toStringTag](): string;
}
/**
 * Provides the ability to be used as either a promise or an event emitter.  Enabling
 * an application to easily retrieve all results using async/await or enabling
 * streaming of results by listening for the row and meta events.
 */
export declare class StreamableRowPromise<T, TRow, TMeta> extends StreamablePromise<T> {
    constructor(fn: (rows: TRow[], meta: TMeta) => T);
}
/**
 * Provides the ability to be used as either a promise or an event emitter.  Enabling
 * an application to easily retrieve all replicas using async/await or enabling
 * streaming of replicas by listening for the replica event.
 */
export declare class StreamableReplicasPromise<T, TRep> extends StreamablePromise<T> {
    constructor(fn: (replicas: TRep[]) => T);
}
/**
 * Provides the ability to be used as either a promise or an event emitter.  Enabling
 * an application to easily retrieve all scan results using async/await or enabling
 * streaming of scan results by listening for the result event.
 */
export declare class StreamableScanPromise<T, TRes> extends StreamablePromise<T> {
    private _cancelRequested;
    constructor(fn: (results: TRes[]) => T);
    get cancelRequested(): boolean;
    cancelStreaming(): void;
}
export {};
