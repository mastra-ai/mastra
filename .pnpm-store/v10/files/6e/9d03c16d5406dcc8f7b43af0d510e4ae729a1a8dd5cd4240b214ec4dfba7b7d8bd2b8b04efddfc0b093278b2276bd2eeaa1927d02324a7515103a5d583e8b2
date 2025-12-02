"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useCallback } from "react";
import {
  useThreadViewport,
  useThreadViewportStore,
} from "../../context/react/ThreadViewportContext";

const useThreadScrollToBottom = () => {
  const isAtBottom = useThreadViewport((s) => s.isAtBottom);

  const threadViewportStore = useThreadViewportStore();

  const handleScrollToBottom = useCallback(() => {
    threadViewportStore.getState().scrollToBottom();
  }, [threadViewportStore]);

  if (isAtBottom) return null;
  return handleScrollToBottom;
};

export namespace ThreadPrimitiveScrollToBottom {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useThreadScrollToBottom>;
}

export const ThreadPrimitiveScrollToBottom = createActionButton(
  "ThreadPrimitive.ScrollToBottom",
  useThreadScrollToBottom,
);
