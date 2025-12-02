"use client";

import { useCallback } from "react";
import { useMessage, useMessageRuntime } from "../../context";
import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";

const useActionBarSpeak = () => {
  const messageRuntime = useMessageRuntime();
  const callback = useCallback(async () => {
    messageRuntime.speak();
  }, [messageRuntime]);

  const hasSpeakableContent = useMessage((m) => {
    return (
      (m.role !== "assistant" || m.status.type !== "running") &&
      m.content.some((c) => c.type === "text" && c.text.length > 0)
    );
  });

  if (!hasSpeakableContent) return null;
  return callback;
};

export namespace ActionBarPrimitiveSpeak {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useActionBarSpeak>;
}

export const ActionBarPrimitiveSpeak = createActionButton(
  "ActionBarPrimitive.Speak",
  useActionBarSpeak,
);
