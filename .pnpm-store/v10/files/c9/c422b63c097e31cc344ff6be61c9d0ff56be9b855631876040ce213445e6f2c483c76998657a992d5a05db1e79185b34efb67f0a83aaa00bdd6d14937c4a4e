import { Unsubscribe } from "../../../types";
export type SubscribableRuntime<TState> = {
    getState: () => TState;
    subscribe: (callback: () => void) => Unsubscribe;
};
export declare function useRuntimeStateInternal<TState, TSelected>(runtime: SubscribableRuntime<TState>, selector?: ((state: TState) => TSelected | TState) | undefined): TSelected | TState;
export declare function useRuntimeState<TState>(runtime: SubscribableRuntime<TState>): TState;
export declare function useRuntimeState<TState, TSelected>(runtime: SubscribableRuntime<TState>, selector: (state: TState) => TSelected): TSelected;
export declare function useRuntimeState<TState, TSelected>(runtime: SubscribableRuntime<TState>, selector: ((state: TState) => TSelected) | undefined): TSelected | TState;
//# sourceMappingURL=useRuntimeState.d.ts.map