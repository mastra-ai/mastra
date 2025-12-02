"use client";

import { useSyncExternalStore } from "react";
import type { Unsubscribe } from "../../types/Unsubscribe";

export type StoreOrRuntime<T> = {
  getState: () => T;
  subscribe: (callback: () => void) => Unsubscribe;
};

export type CombinedSelector<T extends Array<unknown>, R> = (...args: T) => R;

export const createCombinedStore = <T extends Array<unknown>, R>(stores: {
  [K in keyof T]: StoreOrRuntime<T[K]>;
}) => {
  const subscribe = (callback: () => void): Unsubscribe => {
    const unsubscribes = stores.map((store) => store.subscribe(callback));
    return () => {
      for (const unsub of unsubscribes) {
        unsub();
      }
    };
  };

  return (selector: CombinedSelector<T, R>): R => {
    const getSnapshot = (): R =>
      selector(...(stores.map((store) => store.getState()) as T));

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };
};
