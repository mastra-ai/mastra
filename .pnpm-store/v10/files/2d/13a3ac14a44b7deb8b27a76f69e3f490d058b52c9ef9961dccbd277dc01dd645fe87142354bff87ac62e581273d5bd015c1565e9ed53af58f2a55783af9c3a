"use client";

// src/context/react/utils/createContextHook.ts
import { useContext } from "react";
function createContextHook(context, providerName) {
  function useContextHook(options) {
    const contextValue = useContext(context);
    if (!options?.optional && !contextValue) {
      throw new Error(`This component must be used within ${providerName}.`);
    }
    return contextValue;
  }
  return useContextHook;
}
export {
  createContextHook
};
//# sourceMappingURL=createContextHook.js.map