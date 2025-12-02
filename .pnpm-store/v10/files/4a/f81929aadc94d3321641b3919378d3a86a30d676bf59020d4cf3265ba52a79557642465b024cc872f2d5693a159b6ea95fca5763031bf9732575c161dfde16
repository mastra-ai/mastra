"use client";

// src/context/react/ThreadContext.ts
import { createContext, useEffect, useState } from "react";
import { createContextHook } from "./utils/createContextHook.js";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime.js";
var ThreadContext = createContext(null);
var useThreadContext = createContextHook(
  ThreadContext,
  "AssistantRuntimeProvider"
);
function useThreadRuntime(options) {
  const context = useThreadContext(options);
  if (!context) return null;
  return context.useThreadRuntime();
}
var useThread = createStateHookForRuntime(useThreadRuntime);
var useThreadComposerRuntime = (opt) => useThreadRuntime(opt)?.composer ?? null;
var useThreadComposer = createStateHookForRuntime(
  useThreadComposerRuntime
);
function useThreadModelContext(options) {
  const [, rerender] = useState({});
  const runtime = useThreadRuntime(options);
  useEffect(() => {
    return runtime?.unstable_on("model-context-update", () => rerender({}));
  }, [runtime]);
  if (!runtime) return null;
  return runtime?.getModelContext();
}
export {
  ThreadContext,
  useThread,
  useThreadComposer,
  useThreadModelContext,
  useThreadRuntime
};
//# sourceMappingURL=ThreadContext.js.map