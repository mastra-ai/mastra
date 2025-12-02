import { BaseSubscribable } from "./BaseSubscribable";
type Transform<TState, TResult> = {
    execute: () => Promise<TResult>;
    /** transform the state after the promise resolves */
    then?: (state: TState, result: TResult) => TState;
    /** transform the state during resolution and afterwards */
    optimistic?: (state: TState) => TState;
    /** transform the state only while loading */
    loading?: (state: TState, task: Promise<TResult>) => TState;
};
export declare class OptimisticState<TState> extends BaseSubscribable {
    private readonly _pendingTransforms;
    private _baseValue;
    private _cachedValue;
    constructor(initialState: TState);
    private _updateState;
    get baseValue(): TState;
    get value(): TState;
    update(state: TState): void;
    optimisticUpdate<TResult>(transform: Transform<TState, TResult>): Promise<TResult>;
}
export {};
//# sourceMappingURL=OptimisticState.d.ts.map