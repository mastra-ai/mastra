declare const _default: {
    defer: typeof defer;
    deferSet: typeof deferSet;
    delay: typeof delay;
    delayChain: typeof delayChain;
    each: typeof each;
    filter: typeof filter;
    funnel: typeof funnel;
    inspect: typeof inspect;
    map: typeof map;
    once: typeof once;
    props: typeof props;
    reduce: typeof reduce;
    rethrow: typeof rethrow;
    retry: typeof retry;
    some: typeof some;
    specific: typeof specific;
    tap: typeof tap;
    wrapFunction: typeof wrapFunction;
};
export default _default;
/**
 * IfPromise< P, T[, U] > returns T if P is a promise, otherwise returns U (or
 * fallbacks to <never> ).
 */
export declare type IfPromise<P, T, U = never> = P extends Promise<infer _X> ? T : U;
/**
 * IfNotPromise< P, T[, U] > returns U (fallbacks to <never>) if P is a
 * promise, otherwise returns T.
 */
export declare type IfNotPromise<P, T, U = never> = P extends Promise<infer _X> ? U : T;
/**
 * Returns the Promise wrapped value of P, unless it's already a promise, where
 * the promise itself is returned instead.
 *
 * For P being Promise<E>, it returns P
 * For non-promise P, it returns Promise<P>
 */
export declare type PromiseOf<P> = P extends Promise<infer _U> ? P : Promise<P>;
/**
 * Returns the element type of a promise, or the type itself if it isn't
 * wrapped in a promise.
 *
 * For P being Promise<E>, it returns E
 * For non-promise P, it returns P
 */
export declare type PromiseElement<P> = P extends Promise<infer U> ? U : P;
/**
 * Given type P, returns the same type P if it is a Promise, otherwise never.
 */
export declare type EnsurePromise<P> = P extends Promise<infer _U> ? P : never;
/**
 * Given type T, returns the same type T if it is *not* a Promise, otherwise
 * never.
 */
export declare type EnsureNotPromise<T> = T extends Promise<infer _U> ? never : T;
export declare type Callback<R, A extends any[]> = (...args: A) => Promise<R>;
/**
 * Create a maximum concurrency for fn (can be curried)
 *
 * Either specify fn and invoke the returned function, or skip fn and the
 * returned function will take an arbitrary function to limit concurrency for.
 *
 * @param size Concurrency limit
 * @param fn The function to limit the concurrency for
 * @returns Concurrency-limited version of fn
 */
export declare function concurrent<R, A extends any[]>(size: number, fn: Callback<R, A>): (...args: Parameters<typeof fn>) => Promise<ReturnType<typeof fn>>;
export declare function concurrent(size: number): <R, A extends any[]>(fn: Callback<R, A>, ...a: A) => Promise<R>;
export declare function delay(milliseconds: number): Promise<void>;
export declare function delay<T>(milliseconds: number, t: T): Promise<T>;
export declare function delayChain(milliseconds: number): <T>(t: T) => Promise<T>;
export declare function tap<U, Fn extends (t: U) => (void | PromiseLike<void>)>(fn: Fn): (u: U) => Promise<U>;
export declare function props(obj: any): Promise<any>;
export interface ConcurrencyOptions {
    concurrency: number;
}
export declare type FilterMapOptions = Partial<ConcurrencyOptions>;
export declare type MapArray<T> = Array<T | PromiseLike<T>> | ConcatArray<T | PromiseLike<T>>;
export declare type MapFn<T, U> = (t: T, index: number, arr: MapArray<T>) => U | Promise<U>;
export declare type FilterFn<T> = MapFn<T, boolean>;
export declare function filter<T>(filterFn: FilterFn<T>): (t: ConcatArray<T | PromiseLike<T>>) => Promise<Array<T>>;
export declare function filter<T>(opts: FilterMapOptions, filterFn: FilterFn<T>): (t: ConcatArray<T | PromiseLike<T>>) => Promise<Array<T>>;
export declare function filter<T>(arr: ConcatArray<T | PromiseLike<T>>, filterFn: FilterFn<T>): Promise<Array<T>>;
export declare function filter<T>(arr: ConcatArray<T | PromiseLike<T>>, opts: FilterMapOptions, filterFn: FilterFn<T>): Promise<Array<T>>;
export declare function map<T, U>(mapFn: MapFn<T, U>): (t: ConcatArray<T | PromiseLike<T>>) => Promise<Array<U>>;
export declare function map<T, U>(opts: FilterMapOptions, mapFn: MapFn<T, U>): (t: ConcatArray<T | PromiseLike<T>>) => Promise<Array<U>>;
export declare function map<T, U>(arr: ConcatArray<T | PromiseLike<T>>, mapFn: MapFn<T, U>): Promise<Array<U>>;
export declare function map<T, U>(arr: ConcatArray<T | PromiseLike<T>>, opts: FilterMapOptions, mapFn: MapFn<T, U>): Promise<Array<U>>;
export declare type SyncReduceInput<T> = Iterable<T | PromiseLike<T>>;
export declare type ReduceInput<T> = SyncReduceInput<T> | PromiseLike<SyncReduceInput<T>>;
export declare type ReduceFunction<T, R> = (accumulator: R, current: T, index: number, length: number) => R | PromiseLike<R>;
export declare function reduce<T, R>(input: ReduceInput<T>, reducer: ReduceFunction<T, R>): Promise<R | undefined>;
export declare function reduce<T, R>(input: ReduceInput<T>, reducer: ReduceFunction<T, R>, initialValue: R | PromiseLike<R>): Promise<R>;
export declare function reduce<T, R>(reducer: ReduceFunction<T, R>): <U extends SyncReduceInput<T>>(input: U) => Promise<R | undefined>;
export declare function reduce<T, R>(reducer: ReduceFunction<T, R>, initialValue: R | PromiseLike<R>): <U extends SyncReduceInput<T>>(input: U) => Promise<R>;
export declare type EachFn<T> = (t: T, index: number, length: number) => void | Promise<void>;
export declare function each<T>(eachFn: EachFn<T>): (t: ConcatArray<T | PromiseLike<T>>) => Promise<Array<T>>;
export declare function each<T>(arr: ConcatArray<T | PromiseLike<T>>, eachFn: EachFn<T>): Promise<Array<T>>;
export declare function eachImpl<T>(eachFn: EachFn<T>): (t: ConcatArray<T | PromiseLike<T>>) => Promise<Array<T>>;
export declare type SomeReturn<R> = Promise<R | false>;
export declare type SomeSyncReturn<R> = SomeReturn<R> | R | false;
export declare type SomePredicate<T, R> = (t: T) => SomeSyncReturn<R>;
export declare type SomeArray<T> = ConcatArray<T | PromiseLike<T>> | PromiseLike<ConcatArray<T | PromiseLike<T>>>;
export declare function some<T, R>(list: SomeArray<T>, fn: SomePredicate<T, R>): SomeReturn<R>;
export declare function some<T, R>(fn: SomePredicate<T, R>): (list: SomeArray<T>) => SomeReturn<R>;
export declare type OnceRunnee<T, R> = T extends void ? (() => R) : ((t: T) => R);
export interface OnceRunner {
    <T, R>(fn: OnceRunnee<T, R>, t: T): R;
    <R>(fn: OnceRunnee<void, R>): R;
}
export declare function once(): OnceRunner;
export declare function once<R>(fn: OnceRunnee<void, R>): OnceRunnee<void, R>;
export declare function once<T, R>(fn: OnceRunnee<T, R>): OnceRunnee<T, R>;
export declare function retry<R>(times: number, fn: () => R, retryable?: (err: Error) => boolean): R;
export interface Deferred<T> {
    resolve: (t: T | PromiseLike<T>) => void;
    reject: <E extends Error>(err: E) => void;
    promise: Promise<T>;
}
export interface EmptyDeferred {
    resolve: ((t: void | PromiseLike<void>) => void) & (() => void);
    reject: <E extends Error>(err: E) => void;
    promise: Promise<void>;
}
/**
 * Creates a defer object used to pass around a promise and its resolver
 */
export declare function defer<T>(): Deferred<T>;
export declare function defer(v: void): EmptyDeferred;
export interface ResolvedReflection<T> {
    error?: void;
    value: T;
    isResolved: true;
    isRejected: false;
}
export interface RejectedReflection {
    error: Error;
    value?: void;
    isResolved: false;
    isRejected: true;
}
export declare type Reflection<T> = ResolvedReflection<T> | RejectedReflection;
export declare function reflect<T>(promise: Promise<T>): Promise<Reflection<T>>;
export interface InspectablePromise<T> {
    promise: Promise<T>;
    isResolved: boolean;
    isRejected: boolean;
    isPending: boolean;
}
export declare function inspect<T>(promise: Promise<T>): InspectablePromise<T>;
export declare type DeferredInspectable<T> = InspectablePromise<T> & Deferred<T>;
export declare type EmptyDeferredInspectable = InspectablePromise<void> & EmptyDeferred;
/**
 * Creates a defer object used to pass around a promise and its resolver
 */
export declare function deferInspectable<T>(): DeferredInspectable<T>;
export declare function deferInspectable(v: void): EmptyDeferredInspectable;
export declare type ErrorFilterFunction = (err: Error) => boolean;
export interface ErrorFilterObject {
    [key: string]: any;
}
export declare type CatchFilter = ErrorConstructor | ErrorFilterFunction | ErrorFilterObject;
export declare function specific<T, U extends Promise<T>>(filters: CatchFilter | ConcatArray<CatchFilter> | null, handler: (err: Error) => U): (err: Error) => (U);
export declare function specific<T>(filters: CatchFilter | ConcatArray<CatchFilter> | null, handler: (err: Error) => T): (err: Error) => (T | Promise<T>);
export declare function rethrow<T extends Error = any>(fn: (err?: T) => (void | PromiseLike<void>)): (err: T) => Promise<never>;
export declare function wrapFunction<R extends void>(wrap: () => () => R): (<U extends void, V extends Promise<U> | U>(cb: () => V) => V) & (<U extends any, V extends Promise<U> | U>(cb: () => V) => V);
export declare function wrapFunction<T extends {}, R extends void>(wrap: (t: T) => () => R): (<U extends void, V extends Promise<U> | U>(t: T, cb: () => V) => V) & (<U extends any, V extends Promise<U> | U>(t: T, cb: () => V) => V);
export declare function wrapFunction<R extends void>(wrap: () => Promise<() => R>): (<U extends void, V extends Promise<U> | U>(cb: () => V) => Promise<U>) & (<U extends any, V extends Promise<U> | U>(cb: () => V) => Promise<U>);
export declare function wrapFunction<T, R extends void>(wrap: (t: T) => Promise<() => R>): (<U extends void, V extends Promise<U> | U>(t: T, cb: () => V) => Promise<U>) & (<U extends any, V extends Promise<U> | U>(t: T, cb: () => V) => Promise<U>);
export declare function wrapFunction<R extends Promise<void>>(wrap: () => (() => R) | Promise<() => R>): <U, V extends Promise<U> | U>(cb: () => V) => Promise<U>;
export declare function wrapFunction<T, R extends Promise<void>>(wrap: (t: T) => (() => R) | Promise<() => R>): <U, V extends Promise<U> | U>(t: T, cb: () => V) => Promise<U>;
export declare type FunnelShouldRetry = () => boolean;
export declare type FunnelRetry<T> = () => Promise<T>;
export declare type FunnelShortcut = () => void;
export declare type FunnelFunction<T> = (shouldRetry: FunnelShouldRetry, retry: FunnelRetry<T>, shortcut: FunnelShortcut) => Promise<T>;
export declare type Funnel<T> = (funnelFunction: FunnelFunction<T>) => Promise<T>;
export interface FunnelOptions {
    onEmpty: () => void;
    concurrency: number;
}
export declare function funnel<T>(opts?: Partial<FunnelOptions>): Funnel<T>;
export declare class OrderedAsynchrony {
    private deferrals;
    wait(waitForIndex: number | ConcatArray<number>, resolveIndex?: number | ConcatArray<number> | undefined | null, rejectIndex?: number | ConcatArray<number> | undefined | null): Promise<void> & this;
    resolve(index: number | ConcatArray<number>): Promise<void> & this;
    reject(index: number | ConcatArray<number>, error?: Error): Promise<void> & this;
    private ensureDeferral;
    private decorate;
}
export declare function deferSet(): OrderedAsynchrony;
