// src/api/ThreadListRuntime.ts
import { LazyMemoizeSubject } from "./subscribable/LazyMemoizeSubject.js";
import {
  ThreadListItemRuntimeImpl
} from "./ThreadListItemRuntime.js";
import { SKIP_UPDATE } from "./subscribable/SKIP_UPDATE.js";
import { ShallowMemoizeSubject } from "./subscribable/ShallowMemoizeSubject.js";
import {
  ThreadRuntimeImpl
} from "./ThreadRuntime.js";
import { NestedSubscriptionSubject } from "./subscribable/NestedSubscriptionSubject.js";
var getThreadListState = (threadList) => {
  return {
    mainThreadId: threadList.mainThreadId,
    newThread: threadList.newThreadId,
    threads: threadList.threadIds,
    archivedThreads: threadList.archivedThreadIds,
    isLoading: threadList.isLoading
  };
};
var getThreadListItemState = (threadList, threadId) => {
  if (threadId === void 0) return SKIP_UPDATE;
  const threadData = threadList.getItemById(threadId);
  if (!threadData) return SKIP_UPDATE;
  return {
    id: threadData.threadId,
    threadId: threadData.threadId,
    // TODO remove in 0.8.0
    remoteId: threadData.remoteId,
    externalId: threadData.externalId,
    title: threadData.title,
    status: threadData.status,
    isMain: threadData.threadId === threadList.mainThreadId
  };
};
var ThreadListRuntimeImpl = class {
  constructor(_core, _runtimeFactory = ThreadRuntimeImpl) {
    this._core = _core;
    this._runtimeFactory = _runtimeFactory;
    const stateBinding = new LazyMemoizeSubject({
      path: {},
      getState: () => getThreadListState(_core),
      subscribe: (callback) => _core.subscribe(callback)
    });
    this._getState = stateBinding.getState.bind(stateBinding);
    this._mainThreadListItemRuntime = new ThreadListItemRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ref: `threadItems[main]`,
          threadSelector: { type: "main" }
        },
        getState: () => {
          return getThreadListItemState(this._core, this._core.mainThreadId);
        },
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this._core
    );
    this.main = new _runtimeFactory(
      new NestedSubscriptionSubject({
        path: {
          ref: "threads.main",
          threadSelector: { type: "main" }
        },
        getState: () => _core.getMainThreadRuntimeCore(),
        subscribe: (callback) => _core.subscribe(callback)
      }),
      this._mainThreadListItemRuntime
      // TODO capture "main" threadListItem from context around useLocalRuntime / useExternalStoreRuntime
    );
  }
  _getState;
  __internal_bindMethods() {
    this.switchToThread = this.switchToThread.bind(this);
    this.switchToNewThread = this.switchToNewThread.bind(this);
    this.getState = this.getState.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.getById = this.getById.bind(this);
    this.getItemById = this.getItemById.bind(this);
    this.getItemByIndex = this.getItemByIndex.bind(this);
    this.getArchivedItemByIndex = this.getArchivedItemByIndex.bind(this);
  }
  switchToThread(threadId) {
    return this._core.switchToThread(threadId);
  }
  switchToNewThread() {
    return this._core.switchToNewThread();
  }
  getState() {
    return this._getState();
  }
  get isLoading() {
    return this._core.isLoading;
  }
  subscribe(callback) {
    return this._core.subscribe(callback);
  }
  _mainThreadListItemRuntime;
  main;
  get mainItem() {
    return this._mainThreadListItemRuntime;
  }
  getById(threadId) {
    return new this._runtimeFactory(
      new NestedSubscriptionSubject({
        path: {
          ref: "threads[threadId=" + JSON.stringify(threadId) + "]",
          threadSelector: { type: "threadId", threadId }
        },
        getState: () => this._core.getThreadRuntimeCore(threadId),
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this.mainItem
      // TODO capture "main" threadListItem from context around useLocalRuntime / useExternalStoreRuntime
    );
  }
  getItemByIndex(idx) {
    return new ThreadListItemRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ref: `threadItems[${idx}]`,
          threadSelector: { type: "index", index: idx }
        },
        getState: () => {
          return getThreadListItemState(this._core, this._core.threadIds[idx]);
        },
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this._core
    );
  }
  getArchivedItemByIndex(idx) {
    return new ThreadListItemRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ref: `archivedThreadItems[${idx}]`,
          threadSelector: { type: "archiveIndex", index: idx }
        },
        getState: () => {
          return getThreadListItemState(
            this._core,
            this._core.archivedThreadIds[idx]
          );
        },
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this._core
    );
  }
  getItemById(threadId) {
    return new ThreadListItemRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ref: `threadItems[threadId=${threadId}]`,
          threadSelector: { type: "threadId", threadId }
        },
        getState: () => {
          return getThreadListItemState(this._core, threadId);
        },
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this._core
    );
  }
};
export {
  ThreadListRuntimeImpl
};
//# sourceMappingURL=ThreadListRuntime.js.map