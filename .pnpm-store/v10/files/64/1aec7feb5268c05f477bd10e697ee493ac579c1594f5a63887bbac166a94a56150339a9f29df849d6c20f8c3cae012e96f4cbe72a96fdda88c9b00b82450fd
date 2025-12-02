import { SubscribableRuntime } from "./useRuntimeState";
export declare function createStateHookForRuntime<TState>(useRuntime: (options: {
    optional: boolean | undefined;
}) => SubscribableRuntime<TState> | null): {
    (): TState;
    <TSelected>(selector: (state: TState) => TSelected): TSelected;
    <TSelected>(selector: ((state: TState) => TSelected) | undefined): TSelected | TState;
    (options: {
        optional?: false | undefined;
    }): TState;
    (options: {
        optional?: boolean | undefined;
    }): TState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: TState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: TState) => TSelected) | undefined;
    }): TSelected | TState;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: TState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: TState) => TSelected) | undefined;
    }): TSelected | TState | null;
};
//# sourceMappingURL=createStateHookForRuntime.d.ts.map