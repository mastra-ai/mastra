"use client";

import {
  FC,
  PropsWithChildren,
  memo,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AssistantContext } from "../react/AssistantContext";
import { makeAssistantToolUIsStore } from "../stores/AssistantToolUIs";
import { ThreadRuntimeProvider } from "./ThreadRuntimeProvider";
import { AssistantRuntime } from "../../api/AssistantRuntime";
import { create } from "zustand";
import { writableStore } from "../ReadonlyStore";
import { AssistantRuntimeCore } from "../../runtimes/core/AssistantRuntimeCore";
import { ensureBinding } from "../react/utils/ensureBinding";

export namespace AssistantRuntimeProvider {
  export type Props = PropsWithChildren<{
    /**
     * The runtime to provide to the rest of your app.
     */
    runtime: AssistantRuntime;
  }>;
}

const useAssistantRuntimeStore = (runtime: AssistantRuntime) => {
  const [store] = useState(() => create(() => runtime));

  useEffect(() => {
    ensureBinding(runtime);
    ensureBinding(runtime.threads);

    writableStore(store).setState(runtime, true);
  }, [runtime, store]);

  return store;
};

const useAssistantToolUIsStore = () => {
  return useMemo(() => makeAssistantToolUIsStore(), []);
};

const getRenderComponent = (runtime: AssistantRuntime) => {
  return (runtime as { _core?: AssistantRuntimeCore })._core?.RenderComponent;
};

export const AssistantRuntimeProviderImpl: FC<
  AssistantRuntimeProvider.Props
> = ({ children, runtime }) => {
  const useAssistantRuntime = useAssistantRuntimeStore(runtime);
  const useToolUIs = useAssistantToolUIsStore();
  const [context] = useState(() => {
    return {
      useToolUIs,
      useAssistantRuntime,
    };
  });

  const RenderComponent = getRenderComponent(runtime);

  return (
    <AssistantContext.Provider value={context}>
      {RenderComponent && <RenderComponent />}
      <ThreadRuntimeProvider
        runtime={runtime.thread}
        listItemRuntime={runtime.threads.mainItem}
      >
        {children}
      </ThreadRuntimeProvider>
    </AssistantContext.Provider>
  );
};

export const AssistantRuntimeProvider = memo(AssistantRuntimeProviderImpl);
