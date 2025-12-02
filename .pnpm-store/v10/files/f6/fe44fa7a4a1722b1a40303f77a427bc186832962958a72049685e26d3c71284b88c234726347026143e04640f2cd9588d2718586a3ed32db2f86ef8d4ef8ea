import type { StoreApi } from "zustand";

export type ReadonlyStore<T> = Omit<StoreApi<T>, "setState" | "destroy">;

export const writableStore = <T>(store: ReadonlyStore<T> | undefined) => {
  return store as unknown as StoreApi<T>;
};
