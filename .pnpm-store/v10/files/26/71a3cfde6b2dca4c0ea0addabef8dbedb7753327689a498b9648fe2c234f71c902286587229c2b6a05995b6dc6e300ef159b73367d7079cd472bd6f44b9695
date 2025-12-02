"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext";

const useThreadListItemUnarchive = () => {
  const runtime = useThreadListItemRuntime();
  return () => {
    runtime.unarchive();
  };
};

export namespace ThreadListItemPrimitiveUnarchive {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useThreadListItemUnarchive>;
}

export const ThreadListItemPrimitiveUnarchive = createActionButton(
  "ThreadListItemPrimitive.Unarchive",
  useThreadListItemUnarchive,
);
