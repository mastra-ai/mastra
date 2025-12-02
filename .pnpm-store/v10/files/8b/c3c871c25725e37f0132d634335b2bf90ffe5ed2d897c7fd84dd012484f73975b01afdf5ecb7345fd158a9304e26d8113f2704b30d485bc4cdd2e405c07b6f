import {
  SubscribableRuntime,
  useRuntimeStateInternal,
} from "./useRuntimeState";

export function createStateHookForRuntime<TState>(
  useRuntime: (options: {
    optional: boolean | undefined;
  }) => SubscribableRuntime<TState> | null,
) {
  // empty
  function useStoreHook(): TState;

  // selector
  function useStoreHook<TSelected>(
    selector: (state: TState) => TSelected,
  ): TSelected;

  // selector?
  function useStoreHook<TSelected>(
    selector: ((state: TState) => TSelected) | undefined,
  ): TSelected | TState;

  // optional=false
  function useStoreHook(options: { optional?: false | undefined }): TState;

  // optional?
  function useStoreHook(options: {
    optional?: boolean | undefined;
  }): TState | null;

  // optional=false, selector
  function useStoreHook<TSelected>(options: {
    optional?: false | undefined;
    selector: (state: TState) => TSelected;
  }): TSelected;

  // optional=false, selector?
  function useStoreHook<TSelected>(options: {
    optional?: false | undefined;
    selector: ((state: TState) => TSelected) | undefined;
  }): TSelected | TState;

  // optional?, selector
  function useStoreHook<TSelected>(options: {
    optional?: boolean | undefined;
    selector: (state: TState) => TSelected;
  }): TSelected | null;

  // optional?, selector?
  function useStoreHook<TSelected>(options: {
    optional?: boolean | undefined;
    selector: ((state: TState) => TSelected) | undefined;
  }): TSelected | TState | null;

  function useStoreHook<TSelected>(
    param?:
      | ((state: TState) => TSelected)
      | {
          optional?: boolean | undefined;
          selector?: ((state: TState) => TSelected) | undefined;
        },
  ): TSelected | TState | null {
    let optional = false;
    let selector: ((state: TState) => TSelected) | undefined;

    if (typeof param === "function") {
      selector = param;
    } else if (param) {
      optional = !!param.optional;
      selector = param.selector;
    }

    const store = useRuntime({ optional });
    if (!store) return null;

    // it is ok to call useRuntimeStateInternal conditionally because it will never become null if its available
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRuntimeStateInternal(store, selector);
  }

  return useStoreHook;
}
