"use client";

import { useState, useEffect, useMemo } from "react";
import { BaseAssistantRuntimeCore } from "../core/BaseAssistantRuntimeCore";
import { RemoteThreadListThreadListRuntimeCore } from "./RemoteThreadListThreadListRuntimeCore";
import { RemoteThreadListOptions } from "./types";
import { AssistantRuntimeImpl } from "../../internal";
import { AssistantRuntimeCore } from "../core/AssistantRuntimeCore";

class RemoteThreadListRuntimeCore
  extends BaseAssistantRuntimeCore
  implements AssistantRuntimeCore
{
  public readonly threads;

  constructor(options: RemoteThreadListOptions) {
    super();
    this.threads = new RemoteThreadListThreadListRuntimeCore(
      options,
      this._contextProvider,
    );
  }

  public get RenderComponent() {
    return this.threads.__internal_RenderComponent;
  }
}

export const useRemoteThreadListRuntime = (
  options: RemoteThreadListOptions,
) => {
  const [runtime] = useState(() => new RemoteThreadListRuntimeCore(options));
  useEffect(() => {
    runtime.threads.__internal_setOptions(options);
    runtime.threads.__internal_load();
  }, [runtime, options]);
  return useMemo(() => new AssistantRuntimeImpl(runtime), [runtime]);
};
