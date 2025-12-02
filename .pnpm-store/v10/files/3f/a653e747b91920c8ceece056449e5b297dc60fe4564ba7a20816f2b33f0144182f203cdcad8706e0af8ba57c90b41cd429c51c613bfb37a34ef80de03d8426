"use client";

import { createContext } from "react";
import { ReadonlyStore } from "../ReadonlyStore";
import { createContextHook } from "./utils/createContextHook";
import { UseBoundStore } from "zustand";
import { ThreadListItemRuntime } from "../../api/ThreadListItemRuntime";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime";

export type ThreadListItemContextValue = {
  useThreadListItemRuntime: UseBoundStore<ReadonlyStore<ThreadListItemRuntime>>;
};

export const ThreadListItemContext =
  createContext<ThreadListItemContextValue | null>(null);

const useThreadListItemContext = createContextHook(
  ThreadListItemContext,
  "a component passed to <ThreadListPrimitive.Items components={...}>",
);

export function useThreadListItemRuntime(options?: {
  optional?: false | undefined;
}): ThreadListItemRuntime;
export function useThreadListItemRuntime(options?: {
  optional?: boolean | undefined;
}): ThreadListItemRuntime | null;
export function useThreadListItemRuntime(options?: {
  optional?: boolean | undefined;
}) {
  const context = useThreadListItemContext(options);
  if (!context) return null;
  return context.useThreadListItemRuntime();
}

export const useThreadListItem = createStateHookForRuntime(
  useThreadListItemRuntime,
);
