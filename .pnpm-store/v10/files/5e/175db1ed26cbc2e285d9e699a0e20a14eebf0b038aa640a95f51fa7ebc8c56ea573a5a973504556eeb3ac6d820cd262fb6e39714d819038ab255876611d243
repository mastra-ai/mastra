"use client";

// src/context/providers/MessagePartRuntimeProvider.tsx
import { useEffect, useState } from "react";
import { create } from "zustand";
import { MessagePartContext } from "../react/MessagePartContext.js";
import { writableStore } from "../ReadonlyStore.js";
import { ensureBinding } from "../react/utils/ensureBinding.js";
import { jsx } from "react/jsx-runtime";
var useMessagePartRuntimeStore = (runtime) => {
  const [store] = useState(() => create(() => runtime));
  useEffect(() => {
    ensureBinding(runtime);
    writableStore(store).setState(runtime, true);
  }, [runtime, store]);
  return store;
};
var MessagePartRuntimeProvider = ({ runtime, children }) => {
  const useMessagePartRuntime = useMessagePartRuntimeStore(runtime);
  const [context] = useState(() => {
    return { useMessagePartRuntime };
  });
  return /* @__PURE__ */ jsx(MessagePartContext.Provider, { value: context, children });
};
export {
  MessagePartRuntimeProvider
};
//# sourceMappingURL=MessagePartRuntimeProvider.js.map