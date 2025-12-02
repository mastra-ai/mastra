declare const without: <T extends object, P extends keyof T>(obj: T, ...props: P[]) => Omit<T, P>;
declare const removeUndefined: <T extends object>(obj: T) => Partial<T>;
declare const applyFunctionToObj: <T extends Record<string, any>, R>(obj: T, fn: (val: any, key: string) => R) => Record<string, R>;
declare const filterProps: <T extends Record<string, any>>(obj: T, filter: (a: any) => boolean) => T;

export { applyFunctionToObj, filterProps, removeUndefined, without };
