"use client";

import { createContext } from "react";
import type { AssistantToolUIsState } from "../stores/AssistantToolUIs";
import { ReadonlyStore } from "../ReadonlyStore";
import { createContextHook } from "./utils/createContextHook";
import { createContextStoreHook } from "./utils/createContextStoreHook";
import { UseBoundStore } from "zustand";
import { AssistantRuntime } from "../../api/AssistantRuntime";
import { ThreadListRuntime } from "../../api/ThreadListRuntime";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime";

export type AssistantContextValue = {
  useAssistantRuntime: UseBoundStore<ReadonlyStore<AssistantRuntime>>;
  useToolUIs: UseBoundStore<ReadonlyStore<AssistantToolUIsState>>;
};

export const AssistantContext = createContext<AssistantContextValue | null>(
  null,
);

export const useAssistantContext = createContextHook(
  AssistantContext,
  "AssistantRuntimeProvider",
);

/**
 * Hook to access the AssistantRuntime from the current context.
 *
 * The AssistantRuntime provides access to the top-level assistant state and actions,
 * including thread management, tool registration, and configuration.
 *
 * @param options Configuration options
 * @param options.optional Whether the hook should return null if no context is found
 * @returns The AssistantRuntime instance, or null if optional is true and no context exists
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const runtime = useAssistantRuntime();
 *
 *   const handleNewThread = () => {
 *     runtime.switchToNewThread();
 *   };
 *
 *   return <button onClick={handleNewThread}>New Thread</button>;
 * }
 * ```
 */
export function useAssistantRuntime(options?: {
  optional?: false | undefined;
}): AssistantRuntime;
export function useAssistantRuntime(options?: {
  optional?: boolean | undefined;
}): AssistantRuntime | null;
export function useAssistantRuntime(options?: {
  optional?: boolean | undefined;
}) {
  const context = useAssistantContext(options);
  if (!context) return null;
  return context.useAssistantRuntime();
}

export const { useToolUIs, useToolUIsStore } = createContextStoreHook(
  useAssistantContext,
  "useToolUIs",
);

const useThreadListRuntime = (opt: {
  optional: boolean | undefined;
}): ThreadListRuntime | null => useAssistantRuntime(opt)?.threads ?? null;
export const useThreadList = createStateHookForRuntime(useThreadListRuntime);
