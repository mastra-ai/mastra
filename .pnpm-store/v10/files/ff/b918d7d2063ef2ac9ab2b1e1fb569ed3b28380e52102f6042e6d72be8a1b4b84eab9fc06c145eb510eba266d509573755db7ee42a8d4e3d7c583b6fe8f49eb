import { ReadonlyStore } from "../ReadonlyStore";
import { UseBoundStore } from "zustand";
import { ThreadListItemRuntime } from "../../api/ThreadListItemRuntime";
export type ThreadListItemContextValue = {
    useThreadListItemRuntime: UseBoundStore<ReadonlyStore<ThreadListItemRuntime>>;
};
export declare const ThreadListItemContext: import("react").Context<ThreadListItemContextValue | null>;
export declare function useThreadListItemRuntime(options?: {
    optional?: false | undefined;
}): ThreadListItemRuntime;
export declare function useThreadListItemRuntime(options?: {
    optional?: boolean | undefined;
}): ThreadListItemRuntime | null;
export declare const useThreadListItem: {
    (): import("../..").ThreadListItemState;
    <TSelected>(selector: (state: import("../..").ThreadListItemState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("../..").ThreadListItemState) => TSelected) | undefined): import("../..").ThreadListItemState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("../..").ThreadListItemState;
    (options: {
        optional?: boolean | undefined;
    }): import("../..").ThreadListItemState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("../..").ThreadListItemState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("../..").ThreadListItemState) => TSelected) | undefined;
    }): import("../..").ThreadListItemState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("../..").ThreadListItemState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("../..").ThreadListItemState) => TSelected) | undefined;
    }): import("../..").ThreadListItemState | TSelected | null;
};
//# sourceMappingURL=ThreadListItemContext.d.ts.map