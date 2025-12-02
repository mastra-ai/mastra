export interface SharedGuardOptions {
    defaultReturn: any;
    longStackTraces: boolean;
}
export interface SyncGuardOptions extends SharedGuardOptions {
    catchAsync: boolean;
}
export interface AsyncGuardOptions extends SharedGuardOptions {
}
export declare type GuardedFunction0<R> = () => R;
export declare type GuardedFunction1<R, T1> = (t1: T1) => R;
export declare type GuardedFunction2<R, T1, T2> = (t1: T1, t2: T2) => R;
export declare type GuardedFunction3<R, T1, T2, T3> = (t1: T1, t2: T2, t3: T3) => R;
export declare type GuardedFunction4<R, T1, T2, T3, T4> = (t1: T1, t2: T2, t3: T3, t4: T4) => R;
export declare type GuardedFunction5<R, T1, T2, T3, T4, T5> = (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R;
export declare type GuardedFunction6<R, T1, T2, T3, T4, T5, T6> = (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R;
export declare type GuardedFunction7<R, T1, T2, T3, T4, T5, T6, T7> = (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, t7: T7) => R;
export declare type GuardedFunction8<R, T1, T2, T3, T4, T5, T6, T7, T8> = (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, t7: T7, t8: T8) => R;
export declare type GuardedFunctionMaker = (<R>(fn: () => R) => GuardedFunction0<R>) & (<R, T1>(fn: (t1: T1) => R) => GuardedFunction1<R, T1>) & (<R, T1, T2>(fn: (t1: T1, t2: T2) => R) => GuardedFunction2<R, T1, T2>) & (<R, T1, T2, T3>(fn: (t1: T1, t2: T2, t3: T3) => R) => GuardedFunction3<R, T1, T2, T3>) & (<R, T1, T2, T3, T4>(fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R) => GuardedFunction4<R, T1, T2, T3, T4>) & (<R, T1, T2, T3, T4, T5>(fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R) => GuardedFunction5<R, T1, T2, T3, T4, T5>) & (<R, T1, T2, T3, T4, T5, T6>(fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R) => GuardedFunction6<R, T1, T2, T3, T4, T5, T6>) & (<R, T1, T2, T3, T4, T5, T6, T7>(fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, t7: T7) => R) => GuardedFunction7<R, T1, T2, T3, T4, T5, T6, T7>) & (<R, T1, T2, T3, T4, T5, T6, T7, T8>(fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, t7: T7, t8: T8) => R) => GuardedFunction8<R, T1, T2, T3, T4, T5, T6, T7, T8>);
export declare type GuardedAsyncFunction0<R> = () => R | PromiseLike<R>;
export declare type GuardedAsyncFunction1<R, T1> = (t1: T1) => R | PromiseLike<R>;
export declare type GuardedAsyncFunction2<R, T1, T2> = (t1: T1, t2: T2) => R | PromiseLike<R>;
export declare type GuardedAsyncFunction3<R, T1, T2, T3> = (t1: T1, t2: T2, t3: T3) => R | PromiseLike<R>;
export declare type GuardedAsyncFunction4<R, T1, T2, T3, T4> = (t1: T1, t2: T2, t3: T3, t4: T4) => R | PromiseLike<R>;
export declare type GuardedAsyncFunction5<R, T1, T2, T3, T4, T5> = (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R | PromiseLike<R>;
export declare type GuardedAsyncFunction6<R, T1, T2, T3, T4, T5, T6> = (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R | PromiseLike<R>;
export declare type GuardedAsyncFunction7<R, T1, T2, T3, T4, T5, T6, T7> = (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, t7: T7) => R | PromiseLike<R>;
export declare type GuardedAsyncFunction8<R, T1, T2, T3, T4, T5, T6, T7, T8> = (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, t7: T7, t8: T8) => R | PromiseLike<R>;
export declare type GuardedAsyncFunctionMaker = (<R>(fn: () => R) => GuardedAsyncFunction0<R>) & (<R, T1>(fn: (t1: T1) => R | PromiseLike<R>) => GuardedAsyncFunction1<R, T1>) & (<R, T1, T2>(fn: (t1: T1, t2: T2) => R | PromiseLike<R>) => GuardedAsyncFunction2<R, T1, T2>) & (<R, T1, T2, T3>(fn: (t1: T1, t2: T2, t3: T3) => R | PromiseLike<R>) => GuardedAsyncFunction3<R, T1, T2, T3>) & (<R, T1, T2, T3, T4>(fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R | PromiseLike<R>) => GuardedAsyncFunction4<R, T1, T2, T3, T4>) & (<R, T1, T2, T3, T4, T5>(fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R | PromiseLike<R>) => GuardedAsyncFunction5<R, T1, T2, T3, T4, T5>) & (<R, T1, T2, T3, T4, T5, T6>(fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R | PromiseLike<R>) => GuardedAsyncFunction6<R, T1, T2, T3, T4, T5, T6>) & (<R, T1, T2, T3, T4, T5, T6, T7>(fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, t7: T7) => R | PromiseLike<R>) => GuardedAsyncFunction7<R, T1, T2, T3, T4, T5, T6, T7>) & (<R, T1, T2, T3, T4, T5, T6, T7, T8>(fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, t7: T7, t8: T8) => R | PromiseLike<R>) => GuardedAsyncFunction8<R, T1, T2, T3, T4, T5, T6, T7, T8>);
export declare function syncGuard(handler: (err: Error) => void, opts?: Partial<SyncGuardOptions>): GuardedFunctionMaker;
export declare function asyncGuard(handler: (err: Error) => void, opts?: Partial<AsyncGuardOptions>): GuardedAsyncFunctionMaker;
