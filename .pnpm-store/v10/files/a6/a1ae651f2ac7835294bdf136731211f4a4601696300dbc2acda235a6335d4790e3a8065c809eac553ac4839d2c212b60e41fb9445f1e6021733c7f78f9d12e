"use client";

// src/primitives/thread/useThreadViewportAutoScroll.tsx
import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { useCallback, useEffect, useRef } from "react";
import { useThreadRuntime } from "../../context/react/ThreadContext.js";
import { useOnResizeContent } from "../../utils/hooks/useOnResizeContent.js";
import { useOnScrollToBottom } from "../../utils/hooks/useOnScrollToBottom.js";
import { useManagedRef } from "../../utils/hooks/useManagedRef.js";
import { writableStore } from "../../context/ReadonlyStore.js";
import { useThreadViewportStore } from "../../context/react/ThreadViewportContext.js";
var useThreadViewportAutoScroll = ({
  autoScroll = true
}) => {
  const divRef = useRef(null);
  const threadViewportStore = useThreadViewportStore();
  const lastScrollTop = useRef(0);
  const isScrollingToBottomRef = useRef(false);
  const scrollToBottom = useCallback(
    (behavior) => {
      const div = divRef.current;
      if (!div || !autoScroll) return;
      isScrollingToBottomRef.current = true;
      div.scrollTo({ top: div.scrollHeight, behavior });
    },
    [autoScroll]
  );
  const handleScroll = () => {
    const div = divRef.current;
    if (!div) return;
    const isAtBottom = threadViewportStore.getState().isAtBottom;
    const newIsAtBottom = div.scrollHeight - div.scrollTop <= div.clientHeight + 1;
    if (!newIsAtBottom && lastScrollTop.current < div.scrollTop) {
    } else {
      if (newIsAtBottom) {
        isScrollingToBottomRef.current = false;
      }
      if (newIsAtBottom !== isAtBottom) {
        writableStore(threadViewportStore).setState({
          isAtBottom: newIsAtBottom
        });
      }
    }
    lastScrollTop.current = div.scrollTop;
  };
  const resizeRef = useOnResizeContent(() => {
    if (isScrollingToBottomRef.current || threadViewportStore.getState().isAtBottom) {
      scrollToBottom("instant");
    }
    handleScroll();
  });
  const scrollRef = useManagedRef((el) => {
    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  });
  useOnScrollToBottom(() => {
    scrollToBottom("auto");
  });
  const threadRuntime = useThreadRuntime();
  useEffect(() => {
    return threadRuntime.unstable_on("run-start", () => scrollToBottom("auto"));
  }, [scrollToBottom, threadRuntime]);
  const autoScrollRef = useComposedRefs(resizeRef, scrollRef, divRef);
  return autoScrollRef;
};
export {
  useThreadViewportAutoScroll
};
//# sourceMappingURL=useThreadViewportAutoScroll.js.map