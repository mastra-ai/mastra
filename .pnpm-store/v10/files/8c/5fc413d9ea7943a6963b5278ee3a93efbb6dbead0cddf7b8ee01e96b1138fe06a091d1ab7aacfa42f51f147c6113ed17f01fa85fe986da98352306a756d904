// src/context/react/utils/createStateHookForRuntime.ts
import {
  useRuntimeStateInternal
} from "./useRuntimeState.js";
function createStateHookForRuntime(useRuntime) {
  function useStoreHook(param) {
    let optional = false;
    let selector;
    if (typeof param === "function") {
      selector = param;
    } else if (param) {
      optional = !!param.optional;
      selector = param.selector;
    }
    const store = useRuntime({ optional });
    if (!store) return null;
    return useRuntimeStateInternal(store, selector);
  }
  return useStoreHook;
}
export {
  createStateHookForRuntime
};
//# sourceMappingURL=createStateHookForRuntime.js.map