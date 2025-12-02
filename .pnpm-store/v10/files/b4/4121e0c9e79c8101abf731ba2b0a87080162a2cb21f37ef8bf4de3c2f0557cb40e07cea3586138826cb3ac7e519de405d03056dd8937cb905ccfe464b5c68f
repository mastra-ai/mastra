import { ComponentType, FC, PropsWithChildren } from "react";
import { ReadonlyStore } from "../../context/ReadonlyStore";
export declare const SmoothContextProvider: FC<PropsWithChildren>;
export declare const withSmoothContextProvider: <C extends ComponentType<any>>(Component: C) => C;
export declare const useSmoothStatus: {
    (): {
        readonly type: "running";
    } | {
        readonly type: "complete";
    } | {
        readonly type: "incomplete";
        readonly reason: "cancelled" | "length" | "content-filter" | "other" | "error";
        readonly error?: unknown;
    } | {
        readonly type: "requires-action";
        readonly reason: "tool-calls";
    };
    <TSelected>(selector: (state: {
        readonly type: "running";
    } | {
        readonly type: "complete";
    } | {
        readonly type: "incomplete";
        readonly reason: "cancelled" | "length" | "content-filter" | "other" | "error";
        readonly error?: unknown;
    } | {
        readonly type: "requires-action";
        readonly reason: "tool-calls";
    }) => TSelected): TSelected;
    (options: {
        optional: true;
    }): {
        readonly type: "running";
    } | {
        readonly type: "complete";
    } | {
        readonly type: "incomplete";
        readonly reason: "cancelled" | "length" | "content-filter" | "other" | "error";
        readonly error?: unknown;
    } | {
        readonly type: "requires-action";
        readonly reason: "tool-calls";
    } | null;
    <TSelected>(options: {
        optional: true;
        selector?: (state: {
            readonly type: "running";
        } | {
            readonly type: "complete";
        } | {
            readonly type: "incomplete";
            readonly reason: "cancelled" | "length" | "content-filter" | "other" | "error";
            readonly error?: unknown;
        } | {
            readonly type: "requires-action";
            readonly reason: "tool-calls";
        }) => TSelected;
    }): TSelected | null;
}, useSmoothStatusStore: {
    (): ReadonlyStore<{
        readonly type: "running";
    } | {
        readonly type: "complete";
    } | {
        readonly type: "incomplete";
        readonly reason: "cancelled" | "length" | "content-filter" | "other" | "error";
        readonly error?: unknown;
    } | {
        readonly type: "requires-action";
        readonly reason: "tool-calls";
    }>;
    (options: {
        optional: true;
    }): ReadonlyStore<{
        readonly type: "running";
    } | {
        readonly type: "complete";
    } | {
        readonly type: "incomplete";
        readonly reason: "cancelled" | "length" | "content-filter" | "other" | "error";
        readonly error?: unknown;
    } | {
        readonly type: "requires-action";
        readonly reason: "tool-calls";
    }> | null;
};
//# sourceMappingURL=SmoothContext.d.ts.map