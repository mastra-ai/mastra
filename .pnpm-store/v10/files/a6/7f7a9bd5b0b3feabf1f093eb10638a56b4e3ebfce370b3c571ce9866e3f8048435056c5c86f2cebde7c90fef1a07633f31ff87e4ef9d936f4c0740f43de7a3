"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext";

const useThreadListItemDelete = () => {
  const runtime = useThreadListItemRuntime();
  return () => {
    runtime.delete();
  };
};

export namespace ThreadListItemPrimitiveDelete {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useThreadListItemDelete>;
}

export const ThreadListItemPrimitiveDelete = createActionButton(
  "ThreadListItemPrimitive.Delete",
  useThreadListItemDelete,
);
