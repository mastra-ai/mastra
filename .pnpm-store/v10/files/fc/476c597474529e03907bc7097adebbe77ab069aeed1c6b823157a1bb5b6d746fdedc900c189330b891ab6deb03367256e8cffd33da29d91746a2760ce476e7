export declare type Defined<T> = Exclude<T, null | undefined>;
export declare type RemoveMaybe<T> = T extends Maybe<infer Inner> ? Inner : T;
declare type MaybeOnce<T> = Maybe<RemoveMaybe<T>>;
declare type MapCallback<T, U> = (arg: Defined<T>) => U;
export interface Maybe<T> {
    isNone(): boolean;
    orElse(fallback: Defined<T>): Defined<T>;
    orCall(getFallback: () => Defined<T>): Defined<T>;
    orNull(): Defined<T> | null;
    orThrow(message?: string): Defined<T>;
    map<U>(f: MapCallback<T, U>): MaybeOnce<U>;
    get<K extends keyof Defined<T>>(key: K): MaybeOnce<Defined<T>[K]>;
}
export declare const none: Maybe<any>;
export declare function isMaybe(value: unknown): value is MaybeOnce<any>;
export declare function maybe<T>(value: T | null | undefined): MaybeOnce<T>;
export declare function some<T>(value: T): Maybe<T>;
export {};
