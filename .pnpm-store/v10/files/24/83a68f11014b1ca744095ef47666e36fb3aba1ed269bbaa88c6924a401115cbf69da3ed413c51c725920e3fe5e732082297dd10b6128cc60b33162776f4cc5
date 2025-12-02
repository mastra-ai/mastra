"use client";

import { forwardRef } from "react";
import { ActionButtonProps } from "../../utils/createActionButton";
import { composeEventHandlers } from "@radix-ui/primitive";
import { useMessage } from "../../context";
import { Primitive } from "@radix-ui/react-primitive";
import { useCallback } from "react";
import { useMessageRuntime } from "../../context";

const useActionBarFeedbackNegative = () => {
  const messageRuntime = useMessageRuntime();

  const callback = useCallback(() => {
    messageRuntime.submitFeedback({ type: "negative" });
  }, [messageRuntime]);

  return callback;
};

export namespace ActionBarPrimitiveFeedbackNegative {
  export type Element = HTMLButtonElement;
  export type Props = ActionButtonProps<typeof useActionBarFeedbackNegative>;
}

export const ActionBarPrimitiveFeedbackNegative = forwardRef<
  ActionBarPrimitiveFeedbackNegative.Element,
  ActionBarPrimitiveFeedbackNegative.Props
>(({ onClick, disabled, ...props }, forwardedRef) => {
  const isSubmitted = useMessage(
    (u) => u.submittedFeedback?.type === "negative",
  );
  const callback = useActionBarFeedbackNegative();
  return (
    <Primitive.button
      type="button"
      {...(isSubmitted ? { "data-submitted": "true" } : {})}
      {...props}
      ref={forwardedRef}
      disabled={disabled || !callback}
      onClick={composeEventHandlers(onClick, () => {
        callback?.();
      })}
    />
  );
});

ActionBarPrimitiveFeedbackNegative.displayName =
  "ActionBarPrimitive.FeedbackNegative";
