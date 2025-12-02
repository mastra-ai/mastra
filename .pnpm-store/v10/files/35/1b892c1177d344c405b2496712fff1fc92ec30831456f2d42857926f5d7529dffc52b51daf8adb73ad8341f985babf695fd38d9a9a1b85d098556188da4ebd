import type { Unsubscribe } from "../../types/Unsubscribe";
export type StoreOrRuntime<T> = {
    getState: () => T;
    subscribe: (callback: () => void) => Unsubscribe;
};
export type CombinedSelector<T extends Array<unknown>, R> = (...args: T) => R;
export declare const createCombinedStore: <T extends Array<unknown>, R>(stores: { [K in keyof T]: StoreOrRuntime<T[K]>; }) => (selector: CombinedSelector<T, R>) => R;
//# sourceMappingURL=createCombinedStore.d.ts.map