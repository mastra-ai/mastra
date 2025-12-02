"use client";

// src/utils/combined/useCombinedStore.ts
import { useMemo } from "react";
import {
  createCombinedStore
} from "./createCombinedStore.js";
var useCombinedStore = (stores, selector) => {
  const useCombined = useMemo(() => createCombinedStore(stores), stores);
  return useCombined(selector);
};
export {
  useCombinedStore
};
//# sourceMappingURL=useCombinedStore.js.map