"use client";

// src/context/stores/ThreadViewport.tsx
import { create } from "zustand";
var makeThreadViewportStore = () => {
  const scrollToBottomListeners = /* @__PURE__ */ new Set();
  return create(() => ({
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
    }
  }));
};
export {
  makeThreadViewportStore
};
//# sourceMappingURL=ThreadViewport.js.map