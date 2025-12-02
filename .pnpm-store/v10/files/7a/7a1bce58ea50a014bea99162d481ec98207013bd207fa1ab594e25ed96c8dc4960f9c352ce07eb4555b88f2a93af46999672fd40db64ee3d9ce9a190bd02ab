"use client";

// src/runtimes/local/useLocalRuntime.tsx
import { useEffect, useMemo, useState } from "react";
import { LocalRuntimeCore } from "./LocalRuntimeCore.js";
import { useRuntimeAdapters } from "../adapters/RuntimeAdapterProvider.js";
import { useRemoteThreadListRuntime } from "../remote-thread-list/useRemoteThreadListRuntime.js";
import { useCloudThreadListAdapter } from "../remote-thread-list/adapter/cloud.js";
import { AssistantRuntimeImpl } from "../../internal.js";
var useLocalThreadRuntime = (adapter, { initialMessages, ...options }) => {
  const { modelContext, ...threadListAdapters } = useRuntimeAdapters() ?? {};
  const opt = useMemo(
    () => ({
      ...options,
      adapters: {
        ...threadListAdapters,
        ...options.adapters,
        chatModel: adapter
      }
    }),
    [adapter, options, threadListAdapters]
  );
  const [runtime] = useState(() => new LocalRuntimeCore(opt, initialMessages));
  useEffect(() => {
    return () => {
      runtime.threads.getMainThreadRuntimeCore().detach();
    };
  }, [runtime]);
  useEffect(() => {
    runtime.threads.getMainThreadRuntimeCore().__internal_setOptions(opt);
    runtime.threads.getMainThreadRuntimeCore().__internal_load();
  }, [runtime, opt]);
  useEffect(() => {
    if (!modelContext) return void 0;
    return runtime.registerModelContextProvider(modelContext);
  }, [modelContext, runtime]);
  return useMemo(() => new AssistantRuntimeImpl(runtime), [runtime]);
};
var useLocalRuntime = (adapter, { cloud, ...options } = {}) => {
  const cloudAdapter = useCloudThreadListAdapter({ cloud });
  return useRemoteThreadListRuntime({
    runtimeHook: function RuntimeHook() {
      return useLocalThreadRuntime(adapter, options);
    },
    adapter: cloudAdapter
  });
};
export {
  useLocalRuntime,
  useLocalThreadRuntime
};
//# sourceMappingURL=useLocalRuntime.js.map