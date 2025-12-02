// src/utils/CompositeContextProvider.ts
import {
  mergeModelContexts
} from "../model-context/ModelContextTypes.js";
var CompositeContextProvider = class {
  _providers = /* @__PURE__ */ new Set();
  getModelContext() {
    return mergeModelContexts(this._providers);
  }
  registerModelContextProvider(provider) {
    this._providers.add(provider);
    const unsubscribe = provider.subscribe?.(() => {
      this.notifySubscribers();
    });
    this.notifySubscribers();
    return () => {
      this._providers.delete(provider);
      unsubscribe?.();
      this.notifySubscribers();
    };
  }
  _subscribers = /* @__PURE__ */ new Set();
  notifySubscribers() {
    for (const callback of this._subscribers) callback();
  }
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }
};
export {
  CompositeContextProvider
};
//# sourceMappingURL=CompositeContextProvider.js.map