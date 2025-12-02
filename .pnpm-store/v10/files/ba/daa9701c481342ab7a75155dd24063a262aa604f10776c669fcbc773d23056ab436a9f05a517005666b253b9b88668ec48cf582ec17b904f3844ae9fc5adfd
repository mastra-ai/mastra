import { ReadonlyStore } from "../ReadonlyStore";
import { UseBoundStore } from "zustand";
import { ThreadViewportState } from "../stores";
export type ThreadViewportContextValue = {
    useThreadViewport: UseBoundStore<ReadonlyStore<ThreadViewportState>>;
};
export declare const ThreadViewportContext: import("react").Context<ThreadViewportContextValue | null>;
export declare const useThreadViewport: {
    (): ThreadViewportState;
    <TSelected>(selector: (state: ThreadViewportState) => TSelected): TSelected;
    (options: {
        optional: true;
    }): ThreadViewportState | null;
    <TSelected>(options: {
        optional: true;
        selector?: (state: ThreadViewportState) => TSelected;
    }): TSelected | null;
}, useThreadViewportStore: {
    (): ReadonlyStore<ThreadViewportState>;
    (options: {
        optional: true;
    }): ReadonlyStore<ThreadViewportState> | null;
};
//# sourceMappingURL=ThreadViewportContext.d.ts.map