// src/runtimes/composer/DefaultThreadComposerRuntimeCore.tsx
import { BaseComposerRuntimeCore } from "./BaseComposerRuntimeCore.js";
var DefaultThreadComposerRuntimeCore = class extends BaseComposerRuntimeCore {
  constructor(runtime) {
    super();
    this.runtime = runtime;
    this.connect();
  }
  _canCancel = false;
  get canCancel() {
    return this._canCancel;
  }
  get attachments() {
    return super.attachments;
  }
  getAttachmentAdapter() {
    return this.runtime.adapters?.attachments;
  }
  connect() {
    return this.runtime.subscribe(() => {
      if (this.canCancel !== this.runtime.capabilities.cancel) {
        this._canCancel = this.runtime.capabilities.cancel;
        this._notifySubscribers();
      }
    });
  }
  async handleSend(message) {
    this.runtime.append({
      ...message,
      parentId: this.runtime.messages.at(-1)?.id ?? null,
      sourceId: null
    });
  }
  async handleCancel() {
    this.runtime.cancelRun();
  }
};
export {
  DefaultThreadComposerRuntimeCore
};
//# sourceMappingURL=DefaultThreadComposerRuntimeCore.js.map