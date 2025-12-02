"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext";
import { useCallback } from "react";

const useThreadListItemArchive = () => {
  const runtime = useThreadListItemRuntime();
  return useCallback(() => {
    runtime.archive();
  }, [runtime]);
};

export namespace ThreadListItemPrimitiveArchive {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useThreadListItemArchive>;
}

export const ThreadListItemPrimitiveArchive = createActionButton(
  "ThreadListItemPrimitive.Archive",
  useThreadListItemArchive,
);
