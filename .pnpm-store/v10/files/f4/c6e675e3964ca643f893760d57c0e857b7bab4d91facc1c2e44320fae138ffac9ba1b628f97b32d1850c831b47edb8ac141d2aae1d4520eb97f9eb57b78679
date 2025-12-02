"use client";

// src/context/providers/MessageRuntimeProvider.tsx
import { useEffect, useState } from "react";
import { create } from "zustand";
import { MessageContext } from "../react/MessageContext.js";
import { makeMessageUtilsStore } from "../stores/MessageUtils.js";
import { writableStore } from "../ReadonlyStore.js";
import { ensureBinding } from "../react/utils/ensureBinding.js";
import { jsx } from "react/jsx-runtime";
var useMessageRuntimeStore = (runtime) => {
  const [store] = useState(() => create(() => runtime));
  useEffect(() => {
    ensureBinding(runtime);
    writableStore(store).setState(runtime, true);
  }, [runtime, store]);
  return store;
};
var useMessageUtilsStore = () => {
  const [store] = useState(() => makeMessageUtilsStore());
  return store;
};
var MessageRuntimeProvider = ({
  runtime,
  children
}) => {
  const useMessageRuntime = useMessageRuntimeStore(runtime);
  const useMessageUtils = useMessageUtilsStore();
  const [context] = useState(() => {
    return { useMessageRuntime, useMessageUtils };
  });
  return /* @__PURE__ */ jsx(MessageContext.Provider, { value: context, children });
};
export {
  MessageRuntimeProvider
};
//# sourceMappingURL=MessageRuntimeProvider.js.map