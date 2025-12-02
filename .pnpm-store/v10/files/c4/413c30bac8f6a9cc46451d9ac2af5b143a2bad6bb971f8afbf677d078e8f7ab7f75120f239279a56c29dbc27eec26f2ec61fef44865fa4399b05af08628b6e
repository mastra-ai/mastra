"use client";

import { AssistantCloud } from "assistant-cloud";
import { AssistantRuntime } from "../api";
import { useRemoteThreadListRuntime } from "../runtimes/remote-thread-list/useRemoteThreadListRuntime";
import { useCloudThreadListAdapter } from "../runtimes/remote-thread-list/adapter/cloud";

type ThreadData = {
  externalId: string;
};

type CloudThreadListAdapter = {
  cloud: AssistantCloud;

  runtimeHook: () => AssistantRuntime;

  create?(): Promise<ThreadData>;
  delete?(threadId: string): Promise<void>;
};

export const useCloudThreadListRuntime = ({
  runtimeHook,
  ...adapterOptions
}: CloudThreadListAdapter) => {
  const adapter = useCloudThreadListAdapter(adapterOptions);
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: runtimeHook,
    adapter,
  });

  return runtime;
};
