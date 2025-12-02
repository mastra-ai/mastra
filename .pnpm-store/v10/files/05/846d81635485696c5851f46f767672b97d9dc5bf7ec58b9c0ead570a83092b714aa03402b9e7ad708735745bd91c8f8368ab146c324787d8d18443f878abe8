// src/runtimes/local/LocalThreadListRuntimeCore.tsx
import { BaseSubscribable } from "../remote-thread-list/BaseSubscribable.js";
var EMPTY_ARRAY = Object.freeze([]);
var LocalThreadListRuntimeCore = class extends BaseSubscribable {
  _mainThread;
  constructor(_threadFactory) {
    super();
    this._mainThread = _threadFactory();
  }
  get isLoading() {
    return false;
  }
  getMainThreadRuntimeCore() {
    return this._mainThread;
  }
  get newThreadId() {
    throw new Error("Method not implemented.");
  }
  get threadIds() {
    throw EMPTY_ARRAY;
  }
  get archivedThreadIds() {
    throw EMPTY_ARRAY;
  }
  get mainThreadId() {
    return "__DEFAULT_ID__";
  }
  getThreadRuntimeCore() {
    throw new Error("Method not implemented.");
  }
  getLoadThreadsPromise() {
    throw new Error("Method not implemented.");
  }
  getItemById(threadId) {
    if (threadId === this.mainThreadId) {
      return {
        status: "regular",
        threadId: this.mainThreadId,
        remoteId: this.mainThreadId,
        externalId: void 0,
        title: void 0,
        isMain: true
      };
    }
    throw new Error("Method not implemented");
  }
  async switchToThread() {
    throw new Error("Method not implemented.");
  }
  switchToNewThread() {
    throw new Error("Method not implemented.");
  }
  rename() {
    throw new Error("Method not implemented.");
  }
  archive() {
    throw new Error("Method not implemented.");
  }
  detach() {
    throw new Error("Method not implemented.");
  }
  unarchive() {
    throw new Error("Method not implemented.");
  }
  delete() {
    throw new Error("Method not implemented.");
  }
  initialize() {
    throw new Error("Method not implemented.");
  }
  generateTitle() {
    throw new Error("Method not implemented.");
  }
};
export {
  LocalThreadListRuntimeCore
};
//# sourceMappingURL=LocalThreadListRuntimeCore.js.map