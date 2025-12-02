// src/api/ThreadListItemRuntime.ts
var ThreadListItemRuntimeImpl = class {
  constructor(_core, _threadListBinding) {
    this._core = _core;
    this._threadListBinding = _threadListBinding;
  }
  get path() {
    return this._core.path;
  }
  __internal_bindMethods() {
    this.switchTo = this.switchTo.bind(this);
    this.rename = this.rename.bind(this);
    this.archive = this.archive.bind(this);
    this.unarchive = this.unarchive.bind(this);
    this.delete = this.delete.bind(this);
    this.initialize = this.initialize.bind(this);
    this.generateTitle = this.generateTitle.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.unstable_on = this.unstable_on.bind(this);
    this.getState = this.getState.bind(this);
    this.detach = this.detach.bind(this);
  }
  getState() {
    return this._core.getState();
  }
  switchTo() {
    const state = this._core.getState();
    return this._threadListBinding.switchToThread(state.id);
  }
  rename(newTitle) {
    const state = this._core.getState();
    return this._threadListBinding.rename(state.id, newTitle);
  }
  archive() {
    const state = this._core.getState();
    return this._threadListBinding.archive(state.id);
  }
  unarchive() {
    const state = this._core.getState();
    return this._threadListBinding.unarchive(state.id);
  }
  delete() {
    const state = this._core.getState();
    return this._threadListBinding.delete(state.id);
  }
  initialize() {
    const state = this._core.getState();
    return this._threadListBinding.initialize(state.id);
  }
  generateTitle() {
    const state = this._core.getState();
    return this._threadListBinding.generateTitle(state.id);
  }
  unstable_on(event, callback) {
    let prevIsMain = this._core.getState().isMain;
    let prevThreadId = this._core.getState().id;
    return this.subscribe(() => {
      const currentState = this._core.getState();
      const newIsMain = currentState.isMain;
      const newThreadId = currentState.id;
      if (prevIsMain === newIsMain && prevThreadId === newThreadId) return;
      prevIsMain = newIsMain;
      prevThreadId = newThreadId;
      if (event === "switched-to" && !newIsMain) return;
      if (event === "switched-away" && newIsMain) return;
      callback();
    });
  }
  subscribe(callback) {
    return this._core.subscribe(callback);
  }
  detach() {
    const state = this._core.getState();
    this._threadListBinding.detach(state.id);
  }
};
export {
  ThreadListItemRuntimeImpl
};
//# sourceMappingURL=ThreadListItemRuntime.js.map