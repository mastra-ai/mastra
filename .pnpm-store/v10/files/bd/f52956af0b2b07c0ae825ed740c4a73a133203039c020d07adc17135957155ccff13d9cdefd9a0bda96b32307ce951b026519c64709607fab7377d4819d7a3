"use client";

// src/primitives/thread/ThreadScrollToBottom.tsx
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useCallback } from "react";
import {
  useThreadViewport,
  useThreadViewportStore
} from "../../context/react/ThreadViewportContext.js";
var useThreadScrollToBottom = () => {
  const isAtBottom = useThreadViewport((s) => s.isAtBottom);
  const threadViewportStore = useThreadViewportStore();
  const handleScrollToBottom = useCallback(() => {
    threadViewportStore.getState().scrollToBottom();
  }, [threadViewportStore]);
  if (isAtBottom) return null;
  return handleScrollToBottom;
};
var ThreadPrimitiveScrollToBottom = createActionButton(
  "ThreadPrimitive.ScrollToBottom",
  useThreadScrollToBottom
);
export {
  ThreadPrimitiveScrollToBottom
};
//# sourceMappingURL=ThreadScrollToBottom.js.map