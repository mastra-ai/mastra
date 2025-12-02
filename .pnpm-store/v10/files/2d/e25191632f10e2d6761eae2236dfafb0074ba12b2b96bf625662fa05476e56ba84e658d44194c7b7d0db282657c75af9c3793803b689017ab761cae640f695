import { ReadonlyStore } from "../ReadonlyStore";
import { UseBoundStore } from "zustand";
import { ThreadRuntime } from "../../api/ThreadRuntime";
import { ModelContext } from "../../model-context";
export type ThreadContextValue = {
    useThreadRuntime: UseBoundStore<ReadonlyStore<ThreadRuntime>>;
};
export declare const ThreadContext: import("react").Context<ThreadContextValue | null>;
/**
 * Hook to access the ThreadRuntime from the current context.
 *
 * The ThreadRuntime provides access to thread-level state and actions,
 * including message management, thread state, and composer functionality.
 *
 * @param options Configuration options
 * @param options.optional Whether the hook should return null if no context is found
 * @returns The ThreadRuntime instance, or null if optional is true and no context exists
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const runtime = useThreadRuntime();
 *
 *   const handleSendMessage = (text: string) => {
 *     runtime.append({ role: "user", content: [{ type: "text", text }] });
 *   };
 *
 *   return <button onClick={() => handleSendMessage("Hello!")}>Send</button>;
 * }
 * ```
 */
export declare function useThreadRuntime(options?: {
    optional?: false | undefined;
}): ThreadRuntime;
export declare function useThreadRuntime(options?: {
    optional?: boolean | undefined;
}): ThreadRuntime | null;
/**
 * Hook to access the current thread state.
 *
 * This hook provides reactive access to the thread's state, including messages,
 * running status, capabilities, and other thread-level properties.
 *
 * @param selector Optional selector function to pick specific state properties
 * @returns The selected thread state or the entire thread state if no selector provided
 *
 * @example
 * ```tsx
 * function ThreadStatus() {
 *   const isRunning = useThread((state) => state.isRunning);
 *   const messageCount = useThread((state) => state.messages.length);
 *
 *   return <div>Running: {isRunning}, Messages: {messageCount}</div>;
 * }
 * ```
 */
export declare const useThread: {
    (): import("../..").ThreadState;
    <TSelected>(selector: (state: import("../..").ThreadState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("../..").ThreadState) => TSelected) | undefined): import("../..").ThreadState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("../..").ThreadState;
    (options: {
        optional?: boolean | undefined;
    }): import("../..").ThreadState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("../..").ThreadState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("../..").ThreadState) => TSelected) | undefined;
    }): import("../..").ThreadState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("../..").ThreadState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("../..").ThreadState) => TSelected) | undefined;
    }): import("../..").ThreadState | TSelected | null;
};
export declare const useThreadComposer: {
    (): import("../..").ThreadComposerState;
    <TSelected>(selector: (state: import("../..").ThreadComposerState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("../..").ThreadComposerState) => TSelected) | undefined): import("../..").ThreadComposerState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("../..").ThreadComposerState;
    (options: {
        optional?: boolean | undefined;
    }): import("../..").ThreadComposerState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("../..").ThreadComposerState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("../..").ThreadComposerState) => TSelected) | undefined;
    }): import("../..").ThreadComposerState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("../..").ThreadComposerState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("../..").ThreadComposerState) => TSelected) | undefined;
    }): import("../..").ThreadComposerState | TSelected | null;
};
export declare function useThreadModelContext(options?: {
    optional?: false | undefined;
}): ModelContext;
export declare function useThreadModelContext(options?: {
    optional?: boolean | undefined;
}): ModelContext | null;
//# sourceMappingURL=ThreadContext.d.ts.map