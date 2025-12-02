// src/context/react/utils/createContextStoreHook.ts
function createContextStoreHook(contextHook, contextKey) {
  function useStoreStoreHook(options) {
    const context = contextHook(options);
    if (!context) return null;
    return context[contextKey];
  }
  function useStoreHook(param) {
    let optional = false;
    let selector;
    if (typeof param === "function") {
      selector = param;
    } else if (param && typeof param === "object") {
      optional = !!param.optional;
      selector = param.selector;
    }
    const store = useStoreStoreHook({
      optional
    });
    if (!store) return null;
    return selector ? store(selector) : store();
  }
  return {
    [contextKey]: useStoreHook,
    [`${contextKey}Store`]: useStoreStoreHook
  };
}
export {
  createContextStoreHook
};
//# sourceMappingURL=createContextStoreHook.js.map