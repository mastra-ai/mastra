"use client";

// src/primitives/composer/ComposerSend.tsx
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useCallback } from "react";
import { useCombinedStore } from "../../utils/combined/useCombinedStore.js";
import { useThreadRuntime } from "../../context/react/ThreadContext.js";
import { useComposerRuntime } from "../../context/index.js";
var useComposerSend = () => {
  const composerRuntime = useComposerRuntime();
  const threadRuntime = useThreadRuntime();
  const disabled = useCombinedStore(
    [threadRuntime, composerRuntime],
    (t, c) => t.isRunning || !c.isEditing || c.isEmpty
  );
  const callback = useCallback(() => {
    composerRuntime.send();
  }, [composerRuntime]);
  if (disabled) return null;
  return callback;
};
var ComposerPrimitiveSend = createActionButton(
  "ComposerPrimitive.Send",
  useComposerSend
);
export {
  ComposerPrimitiveSend,
  useComposerSend
};
//# sourceMappingURL=ComposerSend.js.map