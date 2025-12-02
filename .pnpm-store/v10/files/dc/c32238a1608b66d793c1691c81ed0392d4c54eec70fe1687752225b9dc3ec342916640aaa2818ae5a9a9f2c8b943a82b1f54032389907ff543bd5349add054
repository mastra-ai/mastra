"use client";

// src/primitives/thread/ThreadSuggestion.tsx
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useCallback } from "react";
import { useThread } from "../../context/index.js";
import { useThreadRuntime } from "../../context/react/ThreadContext.js";
var useThreadSuggestion = ({
  prompt,
  autoSend
}) => {
  const threadRuntime = useThreadRuntime();
  const disabled = useThread((t) => t.isDisabled);
  const callback = useCallback(() => {
    if (autoSend && !threadRuntime.getState().isRunning) {
      threadRuntime.append(prompt);
    } else {
      threadRuntime.composer.setText(prompt);
    }
  }, [threadRuntime, autoSend, prompt]);
  if (disabled) return null;
  return callback;
};
var ThreadPrimitiveSuggestion = createActionButton(
  "ThreadPrimitive.Suggestion",
  useThreadSuggestion,
  ["prompt", "autoSend", "method"]
);
export {
  ThreadPrimitiveSuggestion
};
//# sourceMappingURL=ThreadSuggestion.js.map