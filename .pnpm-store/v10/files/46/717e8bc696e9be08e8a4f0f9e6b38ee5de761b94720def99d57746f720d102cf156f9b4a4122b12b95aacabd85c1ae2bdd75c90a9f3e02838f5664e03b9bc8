"use client";

// src/context/react/ComposerContext.ts
import { useMessageRuntime } from "./MessageContext.js";
import { useThreadRuntime } from "./ThreadContext.js";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime.js";
function useComposerRuntime(options) {
  const messageRuntime = useMessageRuntime({ optional: true });
  const threadRuntime = useThreadRuntime(options);
  return messageRuntime ? messageRuntime.composer : threadRuntime?.composer ?? null;
}
var useComposer = createStateHookForRuntime(useComposerRuntime);
export {
  useComposer,
  useComposerRuntime
};
//# sourceMappingURL=ComposerContext.js.map