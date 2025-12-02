"use client";

import { forwardRef, useCallback } from "react";
import { ActionButtonProps } from "../../utils/createActionButton";
import { composeEventHandlers } from "@radix-ui/primitive";
import { useMessage, useMessageRuntime } from "../../context";
import { Primitive } from "@radix-ui/react-primitive";

const useActionBarFeedbackPositive = () => {
  const messageRuntime = useMessageRuntime();

  const callback = useCallback(() => {
    messageRuntime.submitFeedback({ type: "positive" });
  }, [messageRuntime]);

  return callback;
};

export namespace ActionBarPrimitiveFeedbackPositive {
  export type Element = HTMLButtonElement;
  export type Props = ActionButtonProps<typeof useActionBarFeedbackPositive>;
}

export const ActionBarPrimitiveFeedbackPositive = forwardRef<
  ActionBarPrimitiveFeedbackPositive.Element,
  ActionBarPrimitiveFeedbackPositive.Props
>(({ onClick, disabled, ...props }, forwardedRef) => {
  const isSubmitted = useMessage(
    (u) => u.submittedFeedback?.type === "positive",
  );
  const callback = useActionBarFeedbackPositive();
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

ActionBarPrimitiveFeedbackPositive.displayName =
  "ActionBarPrimitive.FeedbackPositive";
