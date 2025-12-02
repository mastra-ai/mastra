// src/runtimes/external-store/ExternalStoreRuntimeCore.tsx
import { BaseAssistantRuntimeCore } from "../core/BaseAssistantRuntimeCore.js";
import { ExternalStoreThreadListRuntimeCore } from "./ExternalStoreThreadListRuntimeCore.js";
import { ExternalStoreThreadRuntimeCore } from "./ExternalStoreThreadRuntimeCore.js";
var getThreadListAdapter = (store) => {
  return store.adapters?.threadList ?? {};
};
var ExternalStoreRuntimeCore = class extends BaseAssistantRuntimeCore {
  threads;
  constructor(adapter) {
    super();
    this.threads = new ExternalStoreThreadListRuntimeCore(
      getThreadListAdapter(adapter),
      () => new ExternalStoreThreadRuntimeCore(this._contextProvider, adapter)
    );
  }
  setAdapter(adapter) {
    this.threads.__internal_setAdapter(getThreadListAdapter(adapter));
    this.threads.getMainThreadRuntimeCore().__internal_setAdapter(adapter);
  }
};
export {
  ExternalStoreRuntimeCore
};
//# sourceMappingURL=ExternalStoreRuntimeCore.js.map