type AsNumber<K> = K extends `${infer N extends number}` ? N | K : never;
type TupleIndex<T extends readonly any[]> = Exclude<keyof T, keyof any[]>;
type ObjectKey<T> = keyof T & (string | number);

export type TypePath<T> =
  | []
  | (0 extends 1 & T // IsAny
      ? any[]
      : T extends object // IsObjectOrArrayOrTuple
        ? T extends readonly any[] // IsArrayOrTuple
          ? number extends T["length"] // IsTuple
            ? // Tuple: make union of [index, ...TypePath<element>]
              {
                [K in TupleIndex<T>]: [AsNumber<K>, ...TypePath<T[K]>];
              }[TupleIndex<T>]
            : // Array: use number index
              [number, ...TypePath<T[number]>]
          : // Object: make union of [key, ...TypePath<value>]
            { [K in ObjectKey<T>]: [K, ...TypePath<T[K]>] }[ObjectKey<T>]
        : // Base case: primitive values have no path
          []);

export type TypeAtPath<T, P extends readonly any[]> = P extends [
  infer Head,
  ...infer Rest,
]
  ? Head extends keyof T
    ? TypeAtPath<T[Head], Rest>
    : never
  : T;

export type DeepPartial<T> = T extends readonly any[]
  ? readonly DeepPartial<T[number]>[]
  : T extends { [key: string]: any }
    ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
    : T;
