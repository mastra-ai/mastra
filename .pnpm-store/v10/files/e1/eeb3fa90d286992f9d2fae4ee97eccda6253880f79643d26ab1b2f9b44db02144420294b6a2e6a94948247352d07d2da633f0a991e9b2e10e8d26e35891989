"use client";

// src/context/react/AssistantContext.ts
import { createContext } from "react";
import { createContextHook } from "./utils/createContextHook.js";
import { createContextStoreHook } from "./utils/createContextStoreHook.js";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime.js";
var AssistantContext = createContext(
  null
);
var useAssistantContext = createContextHook(
  AssistantContext,
  "AssistantRuntimeProvider"
);
function useAssistantRuntime(options) {
  const context = useAssistantContext(options);
  if (!context) return null;
  return context.useAssistantRuntime();
}
var { useToolUIs, useToolUIsStore } = createContextStoreHook(
  useAssistantContext,
  "useToolUIs"
);
var useThreadListRuntime = (opt) => useAssistantRuntime(opt)?.threads ?? null;
var useThreadList = createStateHookForRuntime(useThreadListRuntime);
export {
  AssistantContext,
  useAssistantContext,
  useAssistantRuntime,
  useThreadList,
  useToolUIs,
  useToolUIsStore
};
//# sourceMappingURL=AssistantContext.js.map