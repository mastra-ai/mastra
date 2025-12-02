import { ReadonlyStore } from "../ReadonlyStore";
import { UseBoundStore } from "zustand";
import { MessagePartRuntime } from "../../api/MessagePartRuntime";
export type MessagePartContextValue = {
    useMessagePartRuntime: UseBoundStore<ReadonlyStore<MessagePartRuntime>>;
};
export declare const MessagePartContext: import("react").Context<MessagePartContextValue | null>;
export declare function useMessagePartRuntime(options?: {
    optional?: false | undefined;
}): MessagePartRuntime;
export declare function useMessagePartRuntime(options?: {
    optional?: boolean | undefined;
}): MessagePartRuntime | null;
export declare const useMessagePart: {
    (): import("../..").MessagePartState;
    <TSelected>(selector: (state: import("../..").MessagePartState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("../..").MessagePartState) => TSelected) | undefined): import("../..").MessagePartState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("../..").MessagePartState;
    (options: {
        optional?: boolean | undefined;
    }): import("../..").MessagePartState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("../..").MessagePartState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("../..").MessagePartState) => TSelected) | undefined;
    }): import("../..").MessagePartState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("../..").MessagePartState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("../..").MessagePartState) => TSelected) | undefined;
    }): import("../..").MessagePartState | TSelected | null;
};
//# sourceMappingURL=MessagePartContext.d.ts.map