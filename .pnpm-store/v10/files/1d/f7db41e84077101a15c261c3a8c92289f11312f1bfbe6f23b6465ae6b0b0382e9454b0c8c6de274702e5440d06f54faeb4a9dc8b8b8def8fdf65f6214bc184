"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalStoreRuntimeCore } from "./ExternalStoreRuntimeCore";
import { ExternalStoreAdapter } from "./ExternalStoreAdapter";
import {
  AssistantRuntime,
  AssistantRuntimeImpl,
} from "../../api/AssistantRuntime";
import { useRuntimeAdapters } from "../adapters/RuntimeAdapterProvider";

export const useExternalStoreRuntime = <T,>(
  store: ExternalStoreAdapter<T>,
): AssistantRuntime => {
  const [runtime] = useState(() => new ExternalStoreRuntimeCore(store));

  useEffect(() => {
    runtime.setAdapter(store);
  });

  const { modelContext } = useRuntimeAdapters() ?? {};

  useEffect(() => {
    if (!modelContext) return undefined;
    return runtime.registerModelContextProvider(modelContext);
  }, [modelContext, runtime]);

  return useMemo(() => new AssistantRuntimeImpl(runtime), [runtime]);
};
