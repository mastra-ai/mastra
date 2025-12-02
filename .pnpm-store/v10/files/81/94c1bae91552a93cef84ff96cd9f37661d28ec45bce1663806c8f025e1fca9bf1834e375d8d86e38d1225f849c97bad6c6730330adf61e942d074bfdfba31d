"use client";

// src/utils/combined/createCombinedStore.ts
import { useSyncExternalStore } from "react";
var createCombinedStore = (stores) => {
  const subscribe = (callback) => {
    const unsubscribes = stores.map((store) => store.subscribe(callback));
    return () => {
      for (const unsub of unsubscribes) {
        unsub();
      }
    };
  };
  return (selector) => {
    const getSnapshot = () => selector(...stores.map((store) => store.getState()));
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };
};
export {
  createCombinedStore
};
//# sourceMappingURL=createCombinedStore.js.map