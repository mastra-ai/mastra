// src/api/subscribable/LazyMemoizeSubject.ts
import { BaseSubject } from "./BaseSubject.js";
import { SKIP_UPDATE } from "./SKIP_UPDATE.js";
var LazyMemoizeSubject = class extends BaseSubject {
  constructor(binding) {
    super();
    this.binding = binding;
  }
  get path() {
    return this.binding.path;
  }
  _previousStateDirty = true;
  _previousState;
  getState = () => {
    if (!this.isConnected || this._previousStateDirty) {
      const newState = this.binding.getState();
      if (newState !== SKIP_UPDATE) {
        this._previousState = newState;
      }
      this._previousStateDirty = false;
    }
    if (this._previousState === void 0)
      throw new Error("Entry not available in the store");
    return this._previousState;
  };
  _connect() {
    const callback = () => {
      this._previousStateDirty = true;
      this.notifySubscribers();
    };
    return this.binding.subscribe(callback);
  }
};
export {
  LazyMemoizeSubject
};
//# sourceMappingURL=LazyMemoizeSubject.js.map