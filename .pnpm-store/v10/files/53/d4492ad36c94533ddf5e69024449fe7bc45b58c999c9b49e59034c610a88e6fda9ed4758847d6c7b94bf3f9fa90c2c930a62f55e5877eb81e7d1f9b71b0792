import { BaseAssistantRuntimeCore } from "../core/BaseAssistantRuntimeCore";
import { ExternalStoreThreadListRuntimeCore } from "./ExternalStoreThreadListRuntimeCore";
import { ExternalStoreAdapter } from "./ExternalStoreAdapter";
import { ExternalStoreThreadRuntimeCore } from "./ExternalStoreThreadRuntimeCore";

const getThreadListAdapter = (store: ExternalStoreAdapter<any>) => {
  return store.adapters?.threadList ?? {};
};

export class ExternalStoreRuntimeCore extends BaseAssistantRuntimeCore {
  public readonly threads;

  constructor(adapter: ExternalStoreAdapter<any>) {
    super();
    this.threads = new ExternalStoreThreadListRuntimeCore(
      getThreadListAdapter(adapter),
      () => new ExternalStoreThreadRuntimeCore(this._contextProvider, adapter),
    );
  }

  public setAdapter(adapter: ExternalStoreAdapter<any>) {
    // Update the thread list adapter and propagate store changes to the main thread
    this.threads.__internal_setAdapter(getThreadListAdapter(adapter));
    this.threads.getMainThreadRuntimeCore().__internal_setAdapter(adapter);
  }
}
