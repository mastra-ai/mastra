// src/api/AttachmentRuntime.ts
var AttachmentRuntimeImpl = class {
  constructor(_core) {
    this._core = _core;
  }
  get path() {
    return this._core.path;
  }
  __internal_bindMethods() {
    this.getState = this.getState.bind(this);
    this.remove = this.remove.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }
  getState() {
    return this._core.getState();
  }
  subscribe(callback) {
    return this._core.subscribe(callback);
  }
};
var ComposerAttachmentRuntime = class extends AttachmentRuntimeImpl {
  constructor(core, _composerApi) {
    super(core);
    this._composerApi = _composerApi;
  }
  remove() {
    const core = this._composerApi.getState();
    if (!core) throw new Error("Composer is not available");
    return core.removeAttachment(this.getState().id);
  }
};
var ThreadComposerAttachmentRuntimeImpl = class extends ComposerAttachmentRuntime {
  get source() {
    return "thread-composer";
  }
};
var EditComposerAttachmentRuntimeImpl = class extends ComposerAttachmentRuntime {
  get source() {
    return "edit-composer";
  }
};
var MessageAttachmentRuntimeImpl = class extends AttachmentRuntimeImpl {
  get source() {
    return "message";
  }
  constructor(core) {
    super(core);
  }
  remove() {
    throw new Error("Message attachments cannot be removed");
  }
};
export {
  AttachmentRuntimeImpl,
  EditComposerAttachmentRuntimeImpl,
  MessageAttachmentRuntimeImpl,
  ThreadComposerAttachmentRuntimeImpl
};
//# sourceMappingURL=AttachmentRuntime.js.map