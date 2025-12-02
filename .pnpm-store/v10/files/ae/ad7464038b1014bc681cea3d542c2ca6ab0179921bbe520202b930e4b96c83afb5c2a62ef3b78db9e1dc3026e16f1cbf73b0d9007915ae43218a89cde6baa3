"use client";

// src/primitives/actionBar/ActionBarFeedbackNegative.tsx
import { forwardRef } from "react";
import { composeEventHandlers } from "@radix-ui/primitive";
import { useMessage } from "../../context/index.js";
import { Primitive } from "@radix-ui/react-primitive";
import { useCallback } from "react";
import { useMessageRuntime } from "../../context/index.js";
import { jsx } from "react/jsx-runtime";
var useActionBarFeedbackNegative = () => {
  const messageRuntime = useMessageRuntime();
  const callback = useCallback(() => {
    messageRuntime.submitFeedback({ type: "negative" });
  }, [messageRuntime]);
  return callback;
};
var ActionBarPrimitiveFeedbackNegative = forwardRef(({ onClick, disabled, ...props }, forwardedRef) => {
  const isSubmitted = useMessage(
    (u) => u.submittedFeedback?.type === "negative"
  );
  const callback = useActionBarFeedbackNegative();
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
ActionBarPrimitiveFeedbackNegative.displayName = "ActionBarPrimitive.FeedbackNegative";
export {
  ActionBarPrimitiveFeedbackNegative
};
//# sourceMappingURL=ActionBarFeedbackNegative.js.map