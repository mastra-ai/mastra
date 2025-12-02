"use client";

import { createContext } from "react";
import { ReadonlyStore } from "../ReadonlyStore";
import { createContextHook } from "./utils/createContextHook";
import { UseBoundStore } from "zustand";
import { MessagePartRuntime } from "../../api/MessagePartRuntime";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime";

export type MessagePartContextValue = {
  useMessagePartRuntime: UseBoundStore<ReadonlyStore<MessagePartRuntime>>;
};

export const MessagePartContext = createContext<MessagePartContextValue | null>(
  null,
);

const useMessagePartContext = createContextHook(
  MessagePartContext,
  "a component passed to <MessagePrimitive.Parts components={...}>",
);

export function useMessagePartRuntime(options?: {
  optional?: false | undefined;
}): MessagePartRuntime;
export function useMessagePartRuntime(options?: {
  optional?: boolean | undefined;
}): MessagePartRuntime | null;
export function useMessagePartRuntime(options?: {
  optional?: boolean | undefined;
}) {
  const context = useMessagePartContext(options);
  if (!context) return null;
  return context.useMessagePartRuntime();
}

export const useMessagePart = createStateHookForRuntime(useMessagePartRuntime);
