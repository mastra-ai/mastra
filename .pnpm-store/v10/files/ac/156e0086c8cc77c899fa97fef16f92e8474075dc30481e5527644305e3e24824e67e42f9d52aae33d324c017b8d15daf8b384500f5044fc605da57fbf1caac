"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useCallback } from "react";
import { useThread } from "../../context";
import { useThreadRuntime } from "../../context/react/ThreadContext";

const useThreadSuggestion = ({
  prompt,
  autoSend,
}: {
  prompt: string;
  method?: "replace";
  autoSend?: boolean | undefined;
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

export namespace ThreadPrimitiveSuggestion {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useThreadSuggestion>;
}

export const ThreadPrimitiveSuggestion = createActionButton(
  "ThreadPrimitive.Suggestion",
  useThreadSuggestion,
  ["prompt", "autoSend", "method"],
);
