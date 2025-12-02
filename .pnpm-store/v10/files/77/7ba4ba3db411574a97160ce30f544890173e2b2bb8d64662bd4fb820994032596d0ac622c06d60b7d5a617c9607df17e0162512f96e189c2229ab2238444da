"use client";

// src/runtimes/external-store/useExternalStoreRuntime.tsx
import { useEffect, useMemo, useState } from "react";
import { ExternalStoreRuntimeCore } from "./ExternalStoreRuntimeCore.js";
import {
  AssistantRuntimeImpl
} from "../../api/AssistantRuntime.js";
import { useRuntimeAdapters } from "../adapters/RuntimeAdapterProvider.js";
var useExternalStoreRuntime = (store) => {
  const [runtime] = useState(() => new ExternalStoreRuntimeCore(store));
  useEffect(() => {
    runtime.setAdapter(store);
  });
  const { modelContext } = useRuntimeAdapters() ?? {};
  useEffect(() => {
    if (!modelContext) return void 0;
    return runtime.registerModelContextProvider(modelContext);
  }, [modelContext, runtime]);
  return useMemo(() => new AssistantRuntimeImpl(runtime), [runtime]);
};
export {
  useExternalStoreRuntime
};
//# sourceMappingURL=useExternalStoreRuntime.js.map