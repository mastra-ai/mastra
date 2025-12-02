// src/context/react/utils/useRuntimeState.ts
import { useDebugValue, useSyncExternalStore } from "react";
import { ensureBinding } from "./ensureBinding.js";
function useRuntimeStateInternal(runtime, selector = identity) {
  ensureBinding(runtime);
  const slice = useSyncExternalStore(
    runtime.subscribe,
    () => selector(runtime.getState()),
    () => selector(runtime.getState())
  );
  useDebugValue(slice);
  return slice;
}
var identity = (arg) => arg;
function useRuntimeState(runtime, selector) {
  return useRuntimeStateInternal(runtime, selector);
}
export {
  useRuntimeState,
  useRuntimeStateInternal
};
//# sourceMappingURL=useRuntimeState.js.map