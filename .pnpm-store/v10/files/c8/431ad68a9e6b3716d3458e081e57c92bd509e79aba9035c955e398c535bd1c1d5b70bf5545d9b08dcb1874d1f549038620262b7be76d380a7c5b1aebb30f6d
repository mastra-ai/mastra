// src/api/ComposerRuntime.ts
import { LazyMemoizeSubject } from "./subscribable/LazyMemoizeSubject.js";
import {
  EditComposerAttachmentRuntimeImpl,
  ThreadComposerAttachmentRuntimeImpl
} from "./AttachmentRuntime.js";
import { ShallowMemoizeSubject } from "./subscribable/ShallowMemoizeSubject.js";
import { SKIP_UPDATE } from "./subscribable/SKIP_UPDATE.js";
import { EventSubscriptionSubject } from "./subscribable/EventSubscriptionSubject.js";
var EMPTY_ARRAY = Object.freeze([]);
var EMPTY_OBJECT = Object.freeze({});
var getThreadComposerState = (runtime) => {
  return Object.freeze({
    type: "thread",
    isEditing: runtime?.isEditing ?? false,
    canCancel: runtime?.canCancel ?? false,
    isEmpty: runtime?.isEmpty ?? true,
    attachments: runtime?.attachments ?? EMPTY_ARRAY,
    text: runtime?.text ?? "",
    role: runtime?.role ?? "user",
    runConfig: runtime?.runConfig ?? EMPTY_OBJECT,
    value: runtime?.text ?? ""
  });
};
var getEditComposerState = (runtime) => {
  return Object.freeze({
    type: "edit",
    isEditing: runtime?.isEditing ?? false,
    canCancel: runtime?.canCancel ?? false,
    isEmpty: runtime?.isEmpty ?? true,
    text: runtime?.text ?? "",
    role: runtime?.role ?? "user",
    attachments: runtime?.attachments ?? EMPTY_ARRAY,
    runConfig: runtime?.runConfig ?? EMPTY_OBJECT,
    value: runtime?.text ?? ""
  });
};
var ComposerRuntimeImpl = class {
  constructor(_core) {
    this._core = _core;
  }
  get path() {
    return this._core.path;
  }
  __internal_bindMethods() {
    this.setText = this.setText.bind(this);
    this.setRunConfig = this.setRunConfig.bind(this);
    this.getState = this.getState.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.addAttachment = this.addAttachment.bind(this);
    this.reset = this.reset.bind(this);
    this.clearAttachments = this.clearAttachments.bind(this);
    this.send = this.send.bind(this);
    this.cancel = this.cancel.bind(this);
    this.setRole = this.setRole.bind(this);
    this.getAttachmentAccept = this.getAttachmentAccept.bind(this);
    this.getAttachmentByIndex = this.getAttachmentByIndex.bind(this);
    this.unstable_on = this.unstable_on.bind(this);
  }
  setText(text) {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    core.setText(text);
  }
  setRunConfig(runConfig) {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    core.setRunConfig(runConfig);
  }
  addAttachment(file) {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    return core.addAttachment(file);
  }
  reset() {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    return core.reset();
  }
  clearAttachments() {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    return core.clearAttachments();
  }
  send() {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    core.send();
  }
  cancel() {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    core.cancel();
  }
  setRole(role) {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    core.setRole(role);
  }
  subscribe(callback) {
    return this._core.subscribe(callback);
  }
  _eventSubscriptionSubjects = /* @__PURE__ */ new Map();
  unstable_on(event, callback) {
    let subject = this._eventSubscriptionSubjects.get(event);
    if (!subject) {
      subject = new EventSubscriptionSubject({
        event,
        binding: this._core
      });
      this._eventSubscriptionSubjects.set(event, subject);
    }
    return subject.subscribe(callback);
  }
  getAttachmentAccept() {
    const core = this._core.getState();
    if (!core) throw new Error("Composer is not available");
    return core.getAttachmentAccept();
  }
};
var ThreadComposerRuntimeImpl = class extends ComposerRuntimeImpl {
  get path() {
    return this._core.path;
  }
  get type() {
    return "thread";
  }
  _getState;
  constructor(core) {
    const stateBinding = new LazyMemoizeSubject({
      path: core.path,
      getState: () => getThreadComposerState(core.getState()),
      subscribe: (callback) => core.subscribe(callback)
    });
    super({
      path: core.path,
      getState: () => core.getState(),
      subscribe: (callback) => stateBinding.subscribe(callback)
    });
    this._getState = stateBinding.getState.bind(stateBinding);
  }
  getState() {
    return this._getState();
  }
  getAttachmentByIndex(idx) {
    return new ThreadComposerAttachmentRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ...this.path,
          attachmentSource: "thread-composer",
          attachmentSelector: { type: "index", index: idx },
          ref: this.path.ref + `${this.path.ref}.attachments[${idx}]`
        },
        getState: () => {
          const attachments = this.getState().attachments;
          const attachment = attachments[idx];
          if (!attachment) return SKIP_UPDATE;
          return {
            ...attachment,
            source: "thread-composer"
          };
        },
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this._core
    );
  }
};
var EditComposerRuntimeImpl = class extends ComposerRuntimeImpl {
  constructor(core, _beginEdit) {
    const stateBinding = new LazyMemoizeSubject({
      path: core.path,
      getState: () => getEditComposerState(core.getState()),
      subscribe: (callback) => core.subscribe(callback)
    });
    super({
      path: core.path,
      getState: () => core.getState(),
      subscribe: (callback) => stateBinding.subscribe(callback)
    });
    this._beginEdit = _beginEdit;
    this._getState = stateBinding.getState.bind(stateBinding);
  }
  get path() {
    return this._core.path;
  }
  get type() {
    return "edit";
  }
  _getState;
  __internal_bindMethods() {
    super.__internal_bindMethods();
    this.beginEdit = this.beginEdit.bind(this);
  }
  getState() {
    return this._getState();
  }
  beginEdit() {
    this._beginEdit();
  }
  getAttachmentByIndex(idx) {
    return new EditComposerAttachmentRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ...this.path,
          attachmentSource: "edit-composer",
          attachmentSelector: { type: "index", index: idx },
          ref: this.path.ref + `${this.path.ref}.attachments[${idx}]`
        },
        getState: () => {
          const attachments = this.getState().attachments;
          const attachment = attachments[idx];
          if (!attachment) return SKIP_UPDATE;
          return {
            ...attachment,
            source: "edit-composer"
          };
        },
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this._core
    );
  }
};
export {
  ComposerRuntimeImpl,
  EditComposerRuntimeImpl,
  ThreadComposerRuntimeImpl
};
//# sourceMappingURL=ComposerRuntime.js.map