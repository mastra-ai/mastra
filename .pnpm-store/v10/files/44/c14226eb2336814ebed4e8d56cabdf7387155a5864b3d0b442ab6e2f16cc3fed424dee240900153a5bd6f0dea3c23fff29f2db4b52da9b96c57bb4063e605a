"use client";

// src/context/react/MessagePartContext.ts
import { createContext } from "react";
import { createContextHook } from "./utils/createContextHook.js";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime.js";
var MessagePartContext = createContext(
  null
);
var useMessagePartContext = createContextHook(
  MessagePartContext,
  "a component passed to <MessagePrimitive.Parts components={...}>"
);
function useMessagePartRuntime(options) {
  const context = useMessagePartContext(options);
  if (!context) return null;
  return context.useMessagePartRuntime();
}
var useMessagePart = createStateHookForRuntime(useMessagePartRuntime);
export {
  MessagePartContext,
  useMessagePart,
  useMessagePartRuntime
};
//# sourceMappingURL=MessagePartContext.js.map