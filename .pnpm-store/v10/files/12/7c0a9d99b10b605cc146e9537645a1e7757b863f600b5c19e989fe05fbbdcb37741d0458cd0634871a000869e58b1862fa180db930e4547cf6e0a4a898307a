"use client";

// src/primitives/actionBar/ActionBarFeedbackPositive.tsx
import { forwardRef, useCallback } from "react";
import { composeEventHandlers } from "@radix-ui/primitive";
import { useMessage, useMessageRuntime } from "../../context/index.js";
import { Primitive } from "@radix-ui/react-primitive";
import { jsx } from "react/jsx-runtime";
var useActionBarFeedbackPositive = () => {
  const messageRuntime = useMessageRuntime();
  const callback = useCallback(() => {
    messageRuntime.submitFeedback({ type: "positive" });
  }, [messageRuntime]);
  return callback;
};
var ActionBarPrimitiveFeedbackPositive = forwardRef(({ onClick, disabled, ...props }, forwardedRef) => {
  const isSubmitted = useMessage(
    (u) => u.submittedFeedback?.type === "positive"
  );
  const callback = useActionBarFeedbackPositive();
  return /* @__PURE__ */ jsx(
    Primitive.button,
    {
      type: "button",
      ...isSubmitted ? { "data-submitted": "true" } : {},
      ...props,
      ref: forwardedRef,
      disabled: disabled || !callback,
      onClick: composeEventHandlers(onClick, () => {
        callback?.();
      })
    }
  );
});
ActionBarPrimitiveFeedbackPositive.displayName = "ActionBarPrimitive.FeedbackPositive";
export {
  ActionBarPrimitiveFeedbackPositive
};
//# sourceMappingURL=ActionBarFeedbackPositive.js.map