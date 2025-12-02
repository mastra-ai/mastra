"use client";

// src/context/providers/AssistantRuntimeProvider.tsx
import {
  memo,
  useEffect,
  useMemo,
  useState
} from "react";
import { AssistantContext } from "../react/AssistantContext.js";
import { makeAssistantToolUIsStore } from "../stores/AssistantToolUIs.js";
import { ThreadRuntimeProvider } from "./ThreadRuntimeProvider.js";
import { create } from "zustand";
import { writableStore } from "../ReadonlyStore.js";
import { ensureBinding } from "../react/utils/ensureBinding.js";
import { jsx, jsxs } from "react/jsx-runtime";
var useAssistantRuntimeStore = (runtime) => {
  const [store] = useState(() => create(() => runtime));
  useEffect(() => {
    ensureBinding(runtime);
    ensureBinding(runtime.threads);
    writableStore(store).setState(runtime, true);
  }, [runtime, store]);
  return store;
};
var useAssistantToolUIsStore = () => {
  return useMemo(() => makeAssistantToolUIsStore(), []);
};
var getRenderComponent = (runtime) => {
  return runtime._core?.RenderComponent;
};
var AssistantRuntimeProviderImpl = ({ children, runtime }) => {
  const useAssistantRuntime = useAssistantRuntimeStore(runtime);
  const useToolUIs = useAssistantToolUIsStore();
  const [context] = useState(() => {
    return {
      useToolUIs,
      useAssistantRuntime
    };
  });
  const RenderComponent = getRenderComponent(runtime);
  return /* @__PURE__ */ jsxs(AssistantContext.Provider, { value: context, children: [
    RenderComponent && /* @__PURE__ */ jsx(RenderComponent, {}),
    /* @__PURE__ */ jsx(
      ThreadRuntimeProvider,
      {
        runtime: runtime.thread,
        listItemRuntime: runtime.threads.mainItem,
        children
      }
    )
  ] });
};
var AssistantRuntimeProvider = memo(AssistantRuntimeProviderImpl);
export {
  AssistantRuntimeProvider,
  AssistantRuntimeProviderImpl
};
//# sourceMappingURL=AssistantRuntimeProvider.js.map