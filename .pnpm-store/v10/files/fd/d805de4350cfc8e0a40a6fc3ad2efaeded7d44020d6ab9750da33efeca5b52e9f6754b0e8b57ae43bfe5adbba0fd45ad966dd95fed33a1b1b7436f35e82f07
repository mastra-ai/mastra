import { ReadonlyStore } from "../ReadonlyStore";
import { MessageUtilsState } from "../stores/MessageUtils";
import { UseBoundStore } from "zustand";
import { MessageRuntime } from "../../api/MessageRuntime";
export type MessageContextValue = {
    useMessageRuntime: UseBoundStore<ReadonlyStore<MessageRuntime>>;
    useMessageUtils: UseBoundStore<ReadonlyStore<MessageUtilsState>>;
};
export declare const MessageContext: import("react").Context<MessageContextValue | null>;
/**
 * Hook to access the MessageRuntime from the current context.
 *
 * The MessageRuntime provides access to message-level state and actions,
 * including message content, status, editing capabilities, and branching.
 *
 * @param options Configuration options
 * @param options.optional Whether the hook should return null if no context is found
 * @returns The MessageRuntime instance, or null if optional is true and no context exists
 *
 * @example
 * ```tsx
 * function MessageActions() {
 *   const runtime = useMessageRuntime();
 *
 *   const handleReload = () => {
 *     runtime.reload();
 *   };
 *
 *   const handleEdit = () => {
 *     runtime.startEdit();
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleReload}>Reload</button>
 *       <button onClick={handleEdit}>Edit</button>
 *     </div>
 *   );
 * }
 * ```
 */
export declare function useMessageRuntime(options?: {
    optional?: false | undefined;
}): MessageRuntime;
export declare function useMessageRuntime(options?: {
    optional?: boolean | undefined;
}): MessageRuntime | null;
/**
 * Hook to access the current message state.
 *
 * This hook provides reactive access to the message's state, including content,
 * role, status, and other message-level properties.
 *
 * @param selector Optional selector function to pick specific state properties
 * @returns The selected message state or the entire message state if no selector provided
 *
 * @example
 * ```tsx
 * function MessageContent() {
 *   const role = useMessage((state) => state.role);
 *   const content = useMessage((state) => state.content);
 *   const isLoading = useMessage((state) => state.status.type === "running");
 *
 *   return (
 *     <div className={`message-${role}`}>
 *       {isLoading ? "Loading..." : content.map(part => part.text).join("")}
 *     </div>
 *   );
 * }
 * ```
 */
export declare const useMessage: {
    (): import("../..").MessageState;
    <TSelected>(selector: (state: import("../..").MessageState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("../..").MessageState) => TSelected) | undefined): import("../..").MessageState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("../..").MessageState;
    (options: {
        optional?: boolean | undefined;
    }): import("../..").MessageState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("../..").MessageState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("../..").MessageState) => TSelected) | undefined;
    }): import("../..").MessageState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("../..").MessageState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("../..").MessageState) => TSelected) | undefined;
    }): import("../..").MessageState | TSelected | null;
};
export declare const useEditComposer: {
    (): import("../..").EditComposerState;
    <TSelected>(selector: (state: import("../..").EditComposerState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("../..").EditComposerState) => TSelected) | undefined): import("../..").EditComposerState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("../..").EditComposerState;
    (options: {
        optional?: boolean | undefined;
    }): import("../..").EditComposerState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("../..").EditComposerState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("../..").EditComposerState) => TSelected) | undefined;
    }): import("../..").EditComposerState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("../..").EditComposerState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("../..").EditComposerState) => TSelected) | undefined;
    }): import("../..").EditComposerState | TSelected | null;
};
export declare const useMessageUtils: {
    (): MessageUtilsState;
    <TSelected>(selector: (state: MessageUtilsState) => TSelected): TSelected;
    (options: {
        optional: true;
    }): MessageUtilsState | null;
    <TSelected>(options: {
        optional: true;
        selector?: (state: MessageUtilsState) => TSelected;
    }): TSelected | null;
}, useMessageUtilsStore: {
    (): ReadonlyStore<MessageUtilsState>;
    (options: {
        optional: true;
    }): ReadonlyStore<MessageUtilsState> | null;
};
//# sourceMappingURL=MessageContext.d.ts.map