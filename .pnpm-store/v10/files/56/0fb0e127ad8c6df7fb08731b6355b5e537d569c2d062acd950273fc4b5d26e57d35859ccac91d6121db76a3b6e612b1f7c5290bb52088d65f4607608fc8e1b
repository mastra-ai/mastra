import { Maybe, RemoveMaybe, Defined } from './maybe';
declare type UnwrapMaybeProperties<T extends {}> = {
    [K in keyof T]: Defined<RemoveMaybe<T[K]>>;
};
export declare function allProperties<T extends {}>(object: T): Maybe<UnwrapMaybeProperties<T>>;
export {};
