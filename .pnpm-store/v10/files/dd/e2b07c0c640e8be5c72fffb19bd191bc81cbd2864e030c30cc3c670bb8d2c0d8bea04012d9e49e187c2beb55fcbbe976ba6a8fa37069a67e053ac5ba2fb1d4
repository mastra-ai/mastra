"use client";

// src/utils/hooks/useOnScrollToBottom.tsx
import { useCallbackRef } from "@radix-ui/react-use-callback-ref";
import { useEffect } from "react";
import { useThreadViewport } from "../../context/react/ThreadViewportContext.js";
var useOnScrollToBottom = (callback) => {
  const callbackRef = useCallbackRef(callback);
  const onScrollToBottom = useThreadViewport((vp) => vp.onScrollToBottom);
  useEffect(() => {
    return onScrollToBottom(callbackRef);
  }, [onScrollToBottom, callbackRef]);
};
export {
  useOnScrollToBottom
};
//# sourceMappingURL=useOnScrollToBottom.js.map