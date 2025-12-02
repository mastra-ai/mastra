import { UseBoundStore } from "zustand";
import { ReadonlyStore } from "../../ReadonlyStore";

/**
 * Creates hooks for accessing a store within a context.
 * @param contextHook - The hook to access the context.
 * @param contextKey - The key of the store in the context.
 * @returns An object containing the hooks: `use...` and `use...Store`.
 */
export function createContextStoreHook<T, K extends keyof T & string>(
  contextHook: (options?: { optional?: boolean }) => T | null,
  contextKey: K,
) {
  type StoreType = T[K];
  type StateType = StoreType extends ReadonlyStore<infer S> ? S : never;

  // Define useStoreStoreHook with overloads
  function useStoreStoreHook(): ReadonlyStore<StateType>;
  function useStoreStoreHook(options: {
    optional: true;
  }): ReadonlyStore<StateType> | null;
  function useStoreStoreHook(options?: {
    optional?: boolean;
  }): ReadonlyStore<StateType> | null {
    const context = contextHook(options);
    if (!context) return null;
    return context[contextKey] as ReadonlyStore<StateType>;
  }

  // Define useStoreHook with overloads
  function useStoreHook(): StateType;
  function useStoreHook<TSelected>(
    selector: (state: StateType) => TSelected,
  ): TSelected;
  function useStoreHook(options: { optional: true }): StateType | null;
  function useStoreHook<TSelected>(options: {
    optional: true;
    selector?: (state: StateType) => TSelected;
  }): TSelected | null;
  function useStoreHook<TSelected>(
    param?:
      | ((state: StateType) => TSelected)
      | {
          optional?: boolean;
          selector?: (state: StateType) => TSelected;
        },
  ): TSelected | StateType | null {
    let optional = false;
    let selector: ((state: StateType) => TSelected) | undefined;

    if (typeof param === "function") {
      selector = param;
    } else if (param && typeof param === "object") {
      optional = !!param.optional;
      selector = param.selector;
    }

    const store = useStoreStoreHook({
      optional,
    } as any) as UseBoundStore<ReadonlyStore<StateType>>;
    if (!store) return null;
    return selector ? store(selector) : store();
  }

  // Return an object with keys based on contextKey
  return {
    [contextKey]: useStoreHook,
    [`${contextKey}Store`]: useStoreStoreHook,
  } as {
    [P in K]: typeof useStoreHook;
  } & {
    [P in `${K}Store`]: typeof useStoreStoreHook;
  };
}
