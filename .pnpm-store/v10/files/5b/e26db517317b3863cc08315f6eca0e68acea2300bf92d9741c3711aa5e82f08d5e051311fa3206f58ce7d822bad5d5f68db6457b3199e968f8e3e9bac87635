"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChatModelAdapter } from "./ChatModelAdapter";
import { LocalRuntimeCore } from "./LocalRuntimeCore";
import type { LocalRuntimeOptions } from "./LocalRuntimeOptions";
import { useRuntimeAdapters } from "../adapters/RuntimeAdapterProvider";
import { useRemoteThreadListRuntime } from "../remote-thread-list/useRemoteThreadListRuntime";
import { useCloudThreadListAdapter } from "../remote-thread-list/adapter/cloud";
import { AssistantRuntimeImpl } from "../../internal";

export const useLocalThreadRuntime = (
  adapter: ChatModelAdapter,
  { initialMessages, ...options }: LocalRuntimeOptions,
) => {
  const { modelContext, ...threadListAdapters } = useRuntimeAdapters() ?? {};
  const opt = useMemo(
    () => ({
      ...options,
      adapters: {
        ...threadListAdapters,
        ...options.adapters,
        chatModel: adapter,
      },
    }),
    [adapter, options, threadListAdapters],
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
    if (!modelContext) return undefined;
    return runtime.registerModelContextProvider(modelContext);
  }, [modelContext, runtime]);

  return useMemo(() => new AssistantRuntimeImpl(runtime), [runtime]);
};

export const useLocalRuntime = (
  adapter: ChatModelAdapter,
  { cloud, ...options }: LocalRuntimeOptions = {},
) => {
  const cloudAdapter = useCloudThreadListAdapter({ cloud });
  return useRemoteThreadListRuntime({
    runtimeHook: function RuntimeHook() {
      return useLocalThreadRuntime(adapter, options);
    },
    adapter: cloudAdapter,
  });
};
