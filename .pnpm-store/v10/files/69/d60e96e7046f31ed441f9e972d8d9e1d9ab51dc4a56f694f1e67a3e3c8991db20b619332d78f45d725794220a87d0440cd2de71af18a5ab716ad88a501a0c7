"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
} from "../../utils/createActionButton";
import { useAssistantRuntime, useThreadList } from "../../context";
import { forwardRef } from "react";
import { Primitive } from "@radix-ui/react-primitive";
import { composeEventHandlers } from "@radix-ui/primitive";

const useThreadListNew = () => {
  const runtime = useAssistantRuntime();
  return () => {
    runtime.switchToNewThread();
  };
};

export namespace ThreadListPrimitiveNew {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useThreadListNew>;
}

export const ThreadListPrimitiveNew = forwardRef<
  ThreadListPrimitiveNew.Element,
  ThreadListPrimitiveNew.Props
>(({ onClick, disabled, ...props }, forwardedRef) => {
  const isMain = useThreadList((t) => t.newThread === t.mainThreadId);
  const callback = useThreadListNew();

  return (
    <Primitive.button
      type="button"
      {...(isMain ? { "data-active": "true", "aria-current": "true" } : null)}
      {...props}
      ref={forwardedRef}
      disabled={disabled || !callback}
      onClick={composeEventHandlers(onClick, () => {
        callback?.();
      })}
    />
  );
});

ThreadListPrimitiveNew.displayName = "ThreadListPrimitive.New";
