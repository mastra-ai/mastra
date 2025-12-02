"use client";

import { createContext } from "react";
import { ReadonlyStore } from "../ReadonlyStore";
import { UseBoundStore } from "zustand";
import { createContextHook } from "./utils/createContextHook";
import { createContextStoreHook } from "./utils/createContextStoreHook";
import { ThreadViewportState } from "../stores";

export type ThreadViewportContextValue = {
  useThreadViewport: UseBoundStore<ReadonlyStore<ThreadViewportState>>;
};

export const ThreadViewportContext =
  createContext<ThreadViewportContextValue | null>(null);

const useThreadViewportContext = createContextHook(
  ThreadViewportContext,
  "ThreadPrimitive.Viewport",
);

export const { useThreadViewport, useThreadViewportStore } =
  createContextStoreHook(useThreadViewportContext, "useThreadViewport");
