"use client";

import { createContext } from "react";
import { ReadonlyStore } from "../ReadonlyStore";
import { MessageUtilsState } from "../stores/MessageUtils";
import { createContextHook } from "./utils/createContextHook";
import { createContextStoreHook } from "./utils/createContextStoreHook";
import { UseBoundStore } from "zustand";
import { MessageRuntime } from "../../api/MessageRuntime";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime";
import { EditComposerRuntime } from "../../api";

export type MessageContextValue = {
  useMessageRuntime: UseBoundStore<ReadonlyStore<MessageRuntime>>;
  useMessageUtils: UseBoundStore<ReadonlyStore<MessageUtilsState>>;
};

export const MessageContext = createContext<MessageContextValue | null>(null);

const useMessageContext = createContextHook(
  MessageContext,
  "a component passed to <ThreadPrimitive.Messages components={...} />",
);

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
export function useMessageRuntime(options?: {
  optional?: false | undefined;
}): MessageRuntime;
export function useMessageRuntime(options?: {
  optional?: boolean | undefined;
}): MessageRuntime | null;
export function useMessageRuntime(options?: {
  optional?: boolean | undefined;
}) {
  const context = useMessageContext(options);
  if (!context) return null;
  return context.useMessageRuntime();
}

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
export const useMessage = createStateHookForRuntime(useMessageRuntime);

const useEditComposerRuntime = (opt: {
  optional: boolean | undefined;
}): EditComposerRuntime | null => useMessageRuntime(opt)?.composer ?? null;
export const useEditComposer = createStateHookForRuntime(
  useEditComposerRuntime,
);

export const { useMessageUtils, useMessageUtilsStore } = createContextStoreHook(
  useMessageContext,
  "useMessageUtils",
);
