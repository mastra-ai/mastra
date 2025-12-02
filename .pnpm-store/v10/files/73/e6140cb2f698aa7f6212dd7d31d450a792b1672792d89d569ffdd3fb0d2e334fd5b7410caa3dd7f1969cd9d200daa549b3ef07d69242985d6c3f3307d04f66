"use client";

import { useCallbackRef } from "@radix-ui/react-use-callback-ref";
import { useEffect } from "react";
import { useThreadViewport } from "../../context/react/ThreadViewportContext";

export const useOnScrollToBottom = (callback: () => void) => {
  const callbackRef = useCallbackRef(callback);
  const onScrollToBottom = useThreadViewport((vp) => vp.onScrollToBottom);

  useEffect(() => {
    return onScrollToBottom(callbackRef);
  }, [onScrollToBottom, callbackRef]);
};
