import { ReadonlyStore } from "../../ReadonlyStore";
/**
 * Creates hooks for accessing a store within a context.
 * @param contextHook - The hook to access the context.
 * @param contextKey - The key of the store in the context.
 * @returns An object containing the hooks: `use...` and `use...Store`.
 */
export declare function createContextStoreHook<T, K extends keyof T & string>(contextHook: (options?: {
    optional?: boolean;
}) => T | null, contextKey: K): { [P in K]: {
    (): T[K] extends ReadonlyStore<infer S> ? S : never;
    <TSelected>(selector: (state: T[K] extends ReadonlyStore<infer S> ? S : never) => TSelected): TSelected;
    (options: {
        optional: true;
    }): (T[K] extends ReadonlyStore<infer S> ? S : never) | null;
    <TSelected>(options: {
        optional: true;
        selector?: (state: T[K] extends ReadonlyStore<infer S> ? S : never) => TSelected;
    }): TSelected | null;
}; } & { [P in `${K}Store`]: {
    (): ReadonlyStore<T[K] extends ReadonlyStore<infer S> ? S : never>;
    (options: {
        optional: true;
    }): ReadonlyStore<T[K] extends ReadonlyStore<infer S> ? S : never> | null;
}; };
//# sourceMappingURL=createContextStoreHook.d.ts.map