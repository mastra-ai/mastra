import {
  type ModelContextProvider,
  mergeModelContexts,
} from "../model-context/ModelContextTypes";

export class CompositeContextProvider implements ModelContextProvider {
  private _providers = new Set<ModelContextProvider>();

  getModelContext() {
    return mergeModelContexts(this._providers);
  }

  registerModelContextProvider(provider: ModelContextProvider) {
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

  private _subscribers = new Set<() => void>();

  notifySubscribers() {
    for (const callback of this._subscribers) callback();
  }

  subscribe(callback: () => void) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }
}
