"use client";

import { create } from "zustand";
import type { Unsubscribe } from "../../types/Unsubscribe";

export type ThreadViewportState = {
  readonly isAtBottom: boolean;
  readonly scrollToBottom: () => void;
  readonly onScrollToBottom: (callback: () => void) => Unsubscribe;
};

export const makeThreadViewportStore = () => {
  const scrollToBottomListeners = new Set<() => void>();

  return create<ThreadViewportState>(() => ({
    isAtBottom: true,
    scrollToBottom: () => {
      for (const listener of scrollToBottomListeners) {
        listener();
      }
    },
    onScrollToBottom: (callback) => {
      scrollToBottomListeners.add(callback);
      return () => {
        scrollToBottomListeners.delete(callback);
      };
    },
  }));
};
