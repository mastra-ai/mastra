"use client";

// src/runtimes/adapters/RuntimeAdapterProvider.tsx
import { createContext, useContext } from "react";
import { jsx } from "react/jsx-runtime";
var RuntimeAdaptersContext = createContext(null);
var RuntimeAdapterProvider = ({
  adapters,
  children
}) => {
  const context = useContext(RuntimeAdaptersContext);
  return /* @__PURE__ */ jsx(
    RuntimeAdaptersContext.Provider,
    {
      value: {
        ...context,
        ...adapters
      },
      children
    }
  );
};
var useRuntimeAdapters = () => {
  const adapters = useContext(RuntimeAdaptersContext);
  return adapters;
};
export {
  RuntimeAdapterProvider,
  useRuntimeAdapters
};
//# sourceMappingURL=RuntimeAdapterProvider.js.map