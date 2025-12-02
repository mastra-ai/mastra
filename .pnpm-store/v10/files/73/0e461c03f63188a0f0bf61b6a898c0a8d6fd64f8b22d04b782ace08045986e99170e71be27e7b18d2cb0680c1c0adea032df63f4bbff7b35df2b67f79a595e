"use client";

// src/utils/smooth/SmoothContext.tsx
import {
  createContext,
  forwardRef,
  useContext,
  useState
} from "react";
import { create } from "zustand";
import { useMessagePartRuntime } from "../../context/react/MessagePartContext.js";
import { createContextStoreHook } from "../../context/react/utils/createContextStoreHook.js";
import { jsx } from "react/jsx-runtime";
var SmoothContext = createContext(null);
var makeSmoothContext = (initialState) => {
  const useSmoothStatus2 = create(() => initialState);
  return { useSmoothStatus: useSmoothStatus2 };
};
var SmoothContextProvider = ({ children }) => {
  const outer = useSmoothContext({ optional: true });
  const MessagePartRuntime = useMessagePartRuntime();
  const [context] = useState(
    () => makeSmoothContext(MessagePartRuntime.getState().status)
  );
  if (outer) return children;
  return /* @__PURE__ */ jsx(SmoothContext.Provider, { value: context, children });
};
var withSmoothContextProvider = (Component) => {
  const Wrapped = forwardRef((props, ref) => {
    return /* @__PURE__ */ jsx(SmoothContextProvider, { children: /* @__PURE__ */ jsx(Component, { ...props, ref }) });
  });
  Wrapped.displayName = Component.displayName;
  return Wrapped;
};
function useSmoothContext(options) {
  const context = useContext(SmoothContext);
  if (!options?.optional && !context)
    throw new Error(
      "This component must be used within a SmoothContextProvider."
    );
  return context;
}
var { useSmoothStatus, useSmoothStatusStore } = createContextStoreHook(
  useSmoothContext,
  "useSmoothStatus"
);
export {
  SmoothContextProvider,
  useSmoothStatus,
  useSmoothStatusStore,
  withSmoothContextProvider
};
//# sourceMappingURL=SmoothContext.js.map