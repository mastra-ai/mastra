"use client";

// src/context/react/MessageContext.ts
import { createContext } from "react";
import { createContextHook } from "./utils/createContextHook.js";
import { createContextStoreHook } from "./utils/createContextStoreHook.js";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime.js";
var MessageContext = createContext(null);
var useMessageContext = createContextHook(
  MessageContext,
  "a component passed to <ThreadPrimitive.Messages components={...} />"
);
function useMessageRuntime(options) {
  const context = useMessageContext(options);
  if (!context) return null;
  return context.useMessageRuntime();
}
var useMessage = createStateHookForRuntime(useMessageRuntime);
var useEditComposerRuntime = (opt) => useMessageRuntime(opt)?.composer ?? null;
var useEditComposer = createStateHookForRuntime(
  useEditComposerRuntime
);
var { useMessageUtils, useMessageUtilsStore } = createContextStoreHook(
  useMessageContext,
  "useMessageUtils"
);
export {
  MessageContext,
  useEditComposer,
  useMessage,
  useMessageRuntime,
  useMessageUtils,
  useMessageUtilsStore
};
//# sourceMappingURL=MessageContext.js.map