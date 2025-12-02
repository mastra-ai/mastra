"use client";

// src/primitives/actionBar/ActionBarSpeak.tsx
import { useCallback } from "react";
import { useMessage, useMessageRuntime } from "../../context/index.js";
import {
  createActionButton
} from "../../utils/createActionButton.js";
var useActionBarSpeak = () => {
  const messageRuntime = useMessageRuntime();
  const callback = useCallback(async () => {
    messageRuntime.speak();
  }, [messageRuntime]);
  const hasSpeakableContent = useMessage((m) => {
    return (m.role !== "assistant" || m.status.type !== "running") && m.content.some((c) => c.type === "text" && c.text.length > 0);
  });
  if (!hasSpeakableContent) return null;
  return callback;
};
var ActionBarPrimitiveSpeak = createActionButton(
  "ActionBarPrimitive.Speak",
  useActionBarSpeak
);
export {
  ActionBarPrimitiveSpeak
};
//# sourceMappingURL=ActionBarSpeak.js.map