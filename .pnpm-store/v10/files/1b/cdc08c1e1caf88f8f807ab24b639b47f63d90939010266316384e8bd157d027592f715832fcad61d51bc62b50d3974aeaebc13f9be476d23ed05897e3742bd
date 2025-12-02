"use client";

import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { RefCallback, useCallback, useEffect, useRef } from "react";
import { useThreadRuntime } from "../../context/react/ThreadContext";
import { useOnResizeContent } from "../../utils/hooks/useOnResizeContent";
import { useOnScrollToBottom } from "../../utils/hooks/useOnScrollToBottom";
import { useManagedRef } from "../../utils/hooks/useManagedRef";
import { writableStore } from "../../context/ReadonlyStore";
import { useThreadViewportStore } from "../../context/react/ThreadViewportContext";

export namespace useThreadViewportAutoScroll {
  export type Options = {
    autoScroll?: boolean | undefined;
  };
}

export const useThreadViewportAutoScroll = <TElement extends HTMLElement>({
  autoScroll = true,
}: useThreadViewportAutoScroll.Options): RefCallback<TElement> => {
  const divRef = useRef<TElement>(null);

  const threadViewportStore = useThreadViewportStore();

  const lastScrollTop = useRef<number>(0);

  // bug: when ScrollToBottom's button changes its disabled state, the scroll stops
  // fix: delay the state change until the scroll is done
  const isScrollingToBottomRef = useRef(false);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior) => {
      const div = divRef.current;
      if (!div || !autoScroll) return;

      isScrollingToBottomRef.current = true;
      div.scrollTo({ top: div.scrollHeight, behavior });
    },
    [autoScroll],
  );

  const handleScroll = () => {
    const div = divRef.current;
    if (!div) return;

    const isAtBottom = threadViewportStore.getState().isAtBottom;
    const newIsAtBottom =
      div.scrollHeight - div.scrollTop <= div.clientHeight + 1; // TODO figure out why +1 is needed

    if (!newIsAtBottom && lastScrollTop.current < div.scrollTop) {
      // ignore scroll down
    } else {
      if (newIsAtBottom) {
        isScrollingToBottomRef.current = false;
      }

      if (newIsAtBottom !== isAtBottom) {
        writableStore(threadViewportStore).setState({
          isAtBottom: newIsAtBottom,
        });
      }
    }

    lastScrollTop.current = div.scrollTop;
  };

  const resizeRef = useOnResizeContent(() => {
    if (
      isScrollingToBottomRef.current ||
      threadViewportStore.getState().isAtBottom
    ) {
      scrollToBottom("instant");
    }

    handleScroll();
  });

  const scrollRef = useManagedRef<HTMLElement>((el) => {
    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  });

  useOnScrollToBottom(() => {
    scrollToBottom("auto");
  });

  // autoscroll on run start
  const threadRuntime = useThreadRuntime();
  useEffect(() => {
    return threadRuntime.unstable_on("run-start", () => scrollToBottom("auto"));
  }, [scrollToBottom, threadRuntime]);

  const autoScrollRef = useComposedRefs<TElement>(resizeRef, scrollRef, divRef);
  return autoScrollRef as RefCallback<TElement>;
};
