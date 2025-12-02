export type Mutable<T> = {
    -readonly [K in keyof T]: T[K];
};
export interface Ok<T> {
    tag: "Ok";
    value: T;
}
export interface Err<ErrorT> {
    tag: "Err";
    error: ErrorT;
}
export type Result<T, ErrorT> = Ok<T> | Err<ErrorT>;
