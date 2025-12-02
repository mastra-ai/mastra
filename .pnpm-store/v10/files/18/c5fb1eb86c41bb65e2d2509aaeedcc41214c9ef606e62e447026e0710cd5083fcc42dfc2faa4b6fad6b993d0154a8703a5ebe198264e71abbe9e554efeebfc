export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type DeeplyMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeeplyMutable<T[P]> : T[P];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericFunction = (...args: any[]) => any;

export type SafeFunction<T extends GenericFunction> = (
  ...args: Parameters<T>
) => ReturnType<T> | null;
