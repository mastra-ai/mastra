"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext";

const useThreadListItemTrigger = () => {
  const runtime = useThreadListItemRuntime();
  return () => {
    runtime.switchTo();
  };
};

export namespace ThreadListItemPrimitiveTrigger {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useThreadListItemTrigger>;
}

export const ThreadListItemPrimitiveTrigger = createActionButton(
  "ThreadListItemPrimitive.Trigger",
  useThreadListItemTrigger,
);
