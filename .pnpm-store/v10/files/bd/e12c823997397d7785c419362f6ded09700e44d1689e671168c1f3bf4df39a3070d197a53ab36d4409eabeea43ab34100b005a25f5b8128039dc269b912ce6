type AsNumber<K> = K extends `${infer N extends number}` ? N | K : never;
type TupleIndex<T extends readonly any[]> = Exclude<keyof T, keyof any[]>;
type ObjectKey<T> = keyof T & (string | number);
export type TypePath<T> = [] | (0 extends 1 & T ? any[] : T extends object ? T extends readonly any[] ? number extends T["length"] ? {
    [K in TupleIndex<T>]: [AsNumber<K>, ...TypePath<T[K]>];
}[TupleIndex<T>] : [
    number,
    ...TypePath<T[number]>
] : {
    [K in ObjectKey<T>]: [K, ...TypePath<T[K]>];
}[ObjectKey<T>] : [
]);
export type TypeAtPath<T, P extends readonly any[]> = P extends [
    infer Head,
    ...infer Rest
] ? Head extends keyof T ? TypeAtPath<T[Head], Rest> : never : T;
export type DeepPartial<T> = T extends readonly any[] ? readonly DeepPartial<T[number]>[] : T extends {
    [key: string]: any;
} ? {
    readonly [K in keyof T]?: DeepPartial<T[K]>;
} : T;
export {};
//# sourceMappingURL=type-path-utils.d.ts.map