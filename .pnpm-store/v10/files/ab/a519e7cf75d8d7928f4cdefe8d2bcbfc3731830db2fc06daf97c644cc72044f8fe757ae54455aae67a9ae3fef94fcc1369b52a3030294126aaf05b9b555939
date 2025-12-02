"use client";

import type { FC, PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { makeThreadViewportStore } from "../stores/ThreadViewport";
import {
  ThreadViewportContext,
  ThreadViewportContextValue,
  useThreadViewportStore,
} from "../react/ThreadViewportContext";
import { writableStore } from "../ReadonlyStore";

const useThreadViewportStoreValue = () => {
  const outerViewport = useThreadViewportStore({ optional: true });
  const [store] = useState(() => makeThreadViewportStore());

  useEffect(() => {
    return outerViewport?.getState().onScrollToBottom(() => {
      store.getState().scrollToBottom();
    });
  }, [outerViewport, store]);

  useEffect(() => {
    if (!outerViewport) return;
    return store.subscribe((state) => {
      if (outerViewport.getState().isAtBottom !== state.isAtBottom) {
        writableStore(outerViewport).setState({ isAtBottom: state.isAtBottom });
      }
    });
  }, [store, outerViewport]);

  return store;
};

export const ThreadViewportProvider: FC<PropsWithChildren> = ({ children }) => {
  const useThreadViewport = useThreadViewportStoreValue();

  const [context] = useState<ThreadViewportContextValue>(() => {
    return {
      useThreadViewport,
    };
  });

  return (
    <ThreadViewportContext.Provider value={context}>
      {children}
    </ThreadViewportContext.Provider>
  );
};
