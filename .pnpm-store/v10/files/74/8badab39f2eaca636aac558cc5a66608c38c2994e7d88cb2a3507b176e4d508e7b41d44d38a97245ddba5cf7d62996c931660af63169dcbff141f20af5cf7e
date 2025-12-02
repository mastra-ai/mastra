// src/runtimes/external-store/ExternalStoreThreadListRuntimeCore.tsx
var EMPTY_ARRAY = Object.freeze([]);
var DEFAULT_THREAD_ID = "DEFAULT_THREAD_ID";
var DEFAULT_THREADS = Object.freeze([DEFAULT_THREAD_ID]);
var DEFAULT_THREAD = Object.freeze({
  threadId: DEFAULT_THREAD_ID,
  status: "regular"
});
var RESOLVED_PROMISE = Promise.resolve();
var ExternalStoreThreadListRuntimeCore = class {
  constructor(adapter = {}, threadFactory) {
    this.adapter = adapter;
    this.threadFactory = threadFactory;
    this._mainThread = this.threadFactory();
  }
  _mainThreadId = DEFAULT_THREAD_ID;
  _threads = DEFAULT_THREADS;
  _archivedThreads = EMPTY_ARRAY;
  get isLoading() {
    return this.adapter.isLoading ?? false;
  }
  get newThreadId() {
    return void 0;
  }
  get threadIds() {
    return this._threads;
  }
  get archivedThreadIds() {
    return this._archivedThreads;
  }
  getLoadThreadsPromise() {
    return RESOLVED_PROMISE;
  }
  _mainThread;
  get mainThreadId() {
    return this._mainThreadId;
  }
  getMainThreadRuntimeCore() {
    return this._mainThread;
  }
  getThreadRuntimeCore() {
    throw new Error("Method not implemented.");
  }
  getItemById(threadId) {
    for (const thread of this.adapter.threads ?? []) {
      if (thread.threadId === threadId) return thread;
    }
    for (const thread of this.adapter.archivedThreads ?? []) {
      if (thread.threadId === threadId) return thread;
    }
    if (threadId === DEFAULT_THREAD_ID) return DEFAULT_THREAD;
    return void 0;
  }
  __internal_setAdapter(adapter) {
    const previousAdapter = this.adapter;
    this.adapter = adapter;
    const newThreadId = adapter.threadId ?? DEFAULT_THREAD_ID;
    const newThreads = adapter.threads ?? EMPTY_ARRAY;
    const newArchivedThreads = adapter.archivedThreads ?? EMPTY_ARRAY;
    const previousThreadId = previousAdapter.threadId ?? DEFAULT_THREAD_ID;
    const previousThreads = previousAdapter.threads ?? EMPTY_ARRAY;
    const previousArchivedThreads = previousAdapter.archivedThreads ?? EMPTY_ARRAY;
    if (previousThreadId === newThreadId && previousThreads === newThreads && previousArchivedThreads === newArchivedThreads) {
      return;
    }
    if (previousThreads !== newThreads) {
      this._threads = this.adapter.threads?.map((t) => t.threadId) ?? EMPTY_ARRAY;
    }
    if (previousArchivedThreads !== newArchivedThreads) {
      this._archivedThreads = this.adapter.archivedThreads?.map((t) => t.threadId) ?? EMPTY_ARRAY;
    }
    if (previousThreadId !== newThreadId) {
      this._mainThreadId = newThreadId;
      this._mainThread = this.threadFactory();
    }
    this._notifySubscribers();
  }
  async switchToThread(threadId) {
    if (this._mainThreadId === threadId) return;
    const onSwitchToThread = this.adapter.onSwitchToThread;
    if (!onSwitchToThread)
      throw new Error(
        "External store adapter does not support switching to thread"
      );
    onSwitchToThread(threadId);
  }
  async switchToNewThread() {
    const onSwitchToNewThread = this.adapter.onSwitchToNewThread;
    if (!onSwitchToNewThread)
      throw new Error(
        "External store adapter does not support switching to new thread"
      );
    onSwitchToNewThread();
  }
  async rename(threadId, newTitle) {
    const onRename = this.adapter.onRename;
    if (!onRename)
      throw new Error("External store adapter does not support renaming");
    onRename(threadId, newTitle);
  }
  async detach() {
  }
  async archive(threadId) {
    const onArchive = this.adapter.onArchive;
    if (!onArchive)
      throw new Error("External store adapter does not support archiving");
    onArchive(threadId);
  }
  async unarchive(threadId) {
    const onUnarchive = this.adapter.onUnarchive;
    if (!onUnarchive)
      throw new Error("External store adapter does not support unarchiving");
    onUnarchive(threadId);
  }
  async delete(threadId) {
    const onDelete = this.adapter.onDelete;
    if (!onDelete)
      throw new Error("External store adapter does not support deleting");
    onDelete(threadId);
  }
  initialize() {
    throw new Error("Method not implemented.");
  }
  generateTitle() {
    throw new Error("Method not implemented.");
  }
  _subscriptions = /* @__PURE__ */ new Set();
  subscribe(callback) {
    this._subscriptions.add(callback);
    return () => this._subscriptions.delete(callback);
  }
  _notifySubscribers() {
    for (const callback of this._subscriptions) callback();
  }
};
export {
  ExternalStoreThreadListRuntimeCore
};
//# sourceMappingURL=ExternalStoreThreadListRuntimeCore.js.map