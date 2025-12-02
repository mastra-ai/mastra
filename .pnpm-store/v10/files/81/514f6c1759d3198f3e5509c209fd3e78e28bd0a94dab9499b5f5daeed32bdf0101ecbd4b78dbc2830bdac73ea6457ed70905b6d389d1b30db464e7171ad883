type VOrFnReturnsV<T> = T | undefined | ((v: URL) => T);
declare function handleValueOrFn<T>(value: VOrFnReturnsV<T>, url: URL): T | undefined;
declare function handleValueOrFn<T>(value: VOrFnReturnsV<T>, url: URL, defaultValue: T): T;

export { handleValueOrFn as h };
