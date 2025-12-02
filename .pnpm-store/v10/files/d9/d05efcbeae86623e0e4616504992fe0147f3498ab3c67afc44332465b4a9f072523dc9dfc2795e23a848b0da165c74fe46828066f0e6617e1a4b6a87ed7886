"use client";

// src/primitives/actionBar/ActionBarCopy.tsx
import { forwardRef } from "react";
import { composeEventHandlers } from "@radix-ui/primitive";
import { Primitive } from "@radix-ui/react-primitive";
import { useMessageUtils } from "../../context/index.js";
import { useCallback } from "react";
import {
  useMessage,
  useMessageRuntime
} from "../../context/react/MessageContext.js";
import { useComposerRuntime } from "../../context/index.js";
import { jsx } from "react/jsx-runtime";
var useActionBarPrimitiveCopy = ({
  copiedDuration = 3e3
} = {}) => {
  const messageRuntime = useMessageRuntime();
  const composerRuntime = useComposerRuntime();
  const setIsCopied = useMessageUtils((s) => s.setIsCopied);
  const hasCopyableContent = useMessage((message) => {
    return (message.role !== "assistant" || message.status.type !== "running") && message.content.some((c) => c.type === "text" && c.text.length > 0);
  });
  const callback = useCallback(() => {
    const { isEditing, text: composerValue } = composerRuntime.getState();
    const valueToCopy = isEditing ? composerValue : messageRuntime.unstable_getCopyText();
    navigator.clipboard.writeText(valueToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  }, [messageRuntime, setIsCopied, composerRuntime, copiedDuration]);
  if (!hasCopyableContent) return null;
  return callback;
};
var ActionBarPrimitiveCopy = forwardRef(({ copiedDuration, onClick, disabled, ...props }, forwardedRef) => {
  const isCopied = useMessageUtils((u) => u.isCopied);
  const callback = useActionBarPrimitiveCopy({ copiedDuration });
  return /* @__PURE__ */ jsx(
    Primitive.button,
    {
      type: "button",
      ...isCopied ? { "data-copied": "true" } : {},
      ...props,
      ref: forwardedRef,
      disabled: disabled || !callback,
      onClick: composeEventHandlers(onClick, () => {
        callback?.();
      })
    }
  );
});
ActionBarPrimitiveCopy.displayName = "ActionBarPrimitive.Copy";
export {
  ActionBarPrimitiveCopy
};
//# sourceMappingURL=ActionBarCopy.js.map