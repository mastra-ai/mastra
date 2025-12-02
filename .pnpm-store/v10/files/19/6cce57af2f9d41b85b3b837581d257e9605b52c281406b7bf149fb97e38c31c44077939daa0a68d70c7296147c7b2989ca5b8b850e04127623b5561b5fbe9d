"use client";

import { createContext, useEffect, useState } from "react";
import { ReadonlyStore } from "../ReadonlyStore";
import { UseBoundStore } from "zustand";
import { createContextHook } from "./utils/createContextHook";
import { ThreadRuntime } from "../../api/ThreadRuntime";
import { ModelContext } from "../../model-context";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime";
import { ThreadComposerRuntime } from "../../api";

export type ThreadContextValue = {
  useThreadRuntime: UseBoundStore<ReadonlyStore<ThreadRuntime>>;
};

export const ThreadContext = createContext<ThreadContextValue | null>(null);

const useThreadContext = createContextHook(
  ThreadContext,
  "AssistantRuntimeProvider",
);

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
export function useThreadRuntime(options?: {
  optional?: false | undefined;
}): ThreadRuntime;
export function useThreadRuntime(options?: {
  optional?: boolean | undefined;
}): ThreadRuntime | null;
export function useThreadRuntime(options?: { optional?: boolean | undefined }) {
  const context = useThreadContext(options);
  if (!context) return null;
  return context.useThreadRuntime();
}

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
export const useThread = createStateHookForRuntime(useThreadRuntime);

const useThreadComposerRuntime = (opt: {
  optional: boolean | undefined;
}): ThreadComposerRuntime | null => useThreadRuntime(opt)?.composer ?? null;
export const useThreadComposer = createStateHookForRuntime(
  useThreadComposerRuntime,
);

export function useThreadModelContext(options?: {
  optional?: false | undefined;
}): ModelContext;
export function useThreadModelContext(options?: {
  optional?: boolean | undefined;
}): ModelContext | null;
export function useThreadModelContext(options?: {
  optional?: boolean | undefined;
}): ModelContext | null {
  const [, rerender] = useState({});

  const runtime = useThreadRuntime(options);
  useEffect(() => {
    return runtime?.unstable_on("model-context-update", () => rerender({}));
  }, [runtime]);

  if (!runtime) return null;
  return runtime?.getModelContext();
}
