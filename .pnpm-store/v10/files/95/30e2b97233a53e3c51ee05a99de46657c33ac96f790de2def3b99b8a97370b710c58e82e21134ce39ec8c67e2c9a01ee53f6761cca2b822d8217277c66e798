export type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
};
export type ObjectEntries<T> = T extends ArrayLike<infer U> ? Array<[string, U]> : Array<{
    [K in keyof T]: [K, T[K]];
}[keyof T]>;
