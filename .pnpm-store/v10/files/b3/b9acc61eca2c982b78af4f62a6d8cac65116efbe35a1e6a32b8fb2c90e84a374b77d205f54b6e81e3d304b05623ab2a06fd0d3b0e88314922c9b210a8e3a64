import { useDebugValue, useSyncExternalStore } from "react";
import { Unsubscribe } from "../../../types";
import { ensureBinding } from "./ensureBinding";

export type SubscribableRuntime<TState> = {
  getState: () => TState;
  subscribe: (callback: () => void) => Unsubscribe;
};

export function useRuntimeStateInternal<TState, TSelected>(
  runtime: SubscribableRuntime<TState>,
  selector: ((state: TState) => TSelected | TState) | undefined = identity,
): TSelected | TState {
  // TODO move to useRuntimeState
  ensureBinding(runtime);

  const slice = useSyncExternalStore(
    runtime.subscribe,
    () => selector(runtime.getState()),
    () => selector(runtime.getState()),
  );
  useDebugValue(slice);
  return slice;
}

const identity = <T>(arg: T): T => arg;
export function useRuntimeState<TState>(
  runtime: SubscribableRuntime<TState>,
): TState;
export function useRuntimeState<TState, TSelected>(
  runtime: SubscribableRuntime<TState>,
  selector: (state: TState) => TSelected,
): TSelected;
export function useRuntimeState<TState, TSelected>(
  runtime: SubscribableRuntime<TState>,
  selector: ((state: TState) => TSelected) | undefined,
): TSelected | TState;
export function useRuntimeState<TState, TSelected>(
  runtime: SubscribableRuntime<TState>,
  selector?: ((state: TState) => TSelected) | undefined,
): TSelected | TState {
  // ensure that the runtime is bound
  // ensureBinding(runtime);

  return useRuntimeStateInternal(runtime, selector);
}
