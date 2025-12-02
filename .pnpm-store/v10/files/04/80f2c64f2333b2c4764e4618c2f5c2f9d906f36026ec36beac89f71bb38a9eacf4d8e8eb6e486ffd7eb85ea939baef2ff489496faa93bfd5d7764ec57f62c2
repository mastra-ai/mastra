"use client";

// src/runtimes/remote-thread-list/RemoteThreadListThreadListRuntimeCore.tsx
import { generateId } from "../../internal.js";
import { RemoteThreadListHookInstanceManager } from "./RemoteThreadListHookInstanceManager.js";
import { BaseSubscribable } from "./BaseSubscribable.js";
import { EMPTY_THREAD_CORE } from "./EMPTY_THREAD_CORE.js";
import { OptimisticState } from "./OptimisticState.js";
import { Fragment, useEffect, useId } from "react";
import { create } from "zustand";
import { AssistantMessageStream } from "assistant-stream";
import { RuntimeAdapterProvider } from "../adapters/RuntimeAdapterProvider.js";
import { jsx } from "react/jsx-runtime";
function createThreadMappingId(id) {
  return id;
}
var getThreadData = (state, threadIdOrRemoteId) => {
  const idx = state.threadIdMap[threadIdOrRemoteId];
  if (idx === void 0) return void 0;
  return state.threadData[idx];
};
var updateStatusReducer = (state, threadIdOrRemoteId, newStatus) => {
  const data = getThreadData(state, threadIdOrRemoteId);
  if (!data) return state;
  const { threadId, remoteId, status: lastStatus } = data;
  if (lastStatus === newStatus) return state;
  const newState = { ...state };
  switch (lastStatus) {
    case "new":
      newState.newThreadId = void 0;
      break;
    case "regular":
      newState.threadIds = newState.threadIds.filter((t) => t !== threadId);
      break;
    case "archived":
      newState.archivedThreadIds = newState.archivedThreadIds.filter(
        (t) => t !== threadId
      );
      break;
    default: {
      const _exhaustiveCheck = lastStatus;
      throw new Error(`Unsupported state: ${_exhaustiveCheck}`);
    }
  }
  switch (newStatus) {
    case "regular":
      newState.threadIds = [threadId, ...newState.threadIds];
      break;
    case "archived":
      newState.archivedThreadIds = [threadId, ...newState.archivedThreadIds];
      break;
    case "deleted":
      newState.threadData = Object.fromEntries(
        Object.entries(newState.threadData).filter(([key]) => key !== threadId)
      );
      newState.threadIdMap = Object.fromEntries(
        Object.entries(newState.threadIdMap).filter(
          ([key]) => key !== threadId && key !== remoteId
        )
      );
      break;
    default: {
      const _exhaustiveCheck = newStatus;
      throw new Error(`Unsupported state: ${_exhaustiveCheck}`);
    }
  }
  if (newStatus !== "deleted") {
    newState.threadData = {
      ...newState.threadData,
      [threadId]: {
        ...data,
        status: newStatus
      }
    };
  }
  return newState;
};
var RemoteThreadListThreadListRuntimeCore = class extends BaseSubscribable {
  constructor(options, contextProvider) {
    super();
    this.contextProvider = contextProvider;
    this._state.subscribe(() => this._notifySubscribers());
    this._hookManager = new RemoteThreadListHookInstanceManager(
      options.runtimeHook
    );
    this.useProvider = create(() => ({
      Provider: options.adapter.unstable_Provider ?? Fragment
    }));
    this.__internal_setOptions(options);
    this.switchToNewThread();
  }
  _options;
  _hookManager;
  _loadThreadsPromise;
  _mainThreadId;
  _state = new OptimisticState({
    isLoading: false,
    newThreadId: void 0,
    threadIds: [],
    archivedThreadIds: [],
    threadIdMap: {},
    threadData: {}
  });
  getLoadThreadsPromise() {
    if (!this._loadThreadsPromise) {
      this._loadThreadsPromise = this._state.optimisticUpdate({
        execute: () => this._options.adapter.list(),
        loading: (state) => {
          return {
            ...state,
            isLoading: true
          };
        },
        then: (state, l) => {
          const newThreadIds = [];
          const newArchivedThreadIds = [];
          const newThreadIdMap = {};
          const newThreadData = {};
          for (const thread of l.threads) {
            switch (thread.status) {
              case "regular":
                newThreadIds.push(thread.remoteId);
                break;
              case "archived":
                newArchivedThreadIds.push(thread.remoteId);
                break;
              default: {
                const _exhaustiveCheck = thread.status;
                throw new Error(`Unsupported state: ${_exhaustiveCheck}`);
              }
            }
            const mappingId = createThreadMappingId(thread.remoteId);
            newThreadIdMap[thread.remoteId] = mappingId;
            newThreadData[mappingId] = {
              threadId: thread.remoteId,
              remoteId: thread.remoteId,
              externalId: thread.externalId,
              status: thread.status,
              title: thread.title,
              initializeTask: Promise.resolve({
                remoteId: thread.remoteId,
                externalId: thread.externalId
              })
            };
          }
          return {
            ...state,
            threadIds: newThreadIds,
            archivedThreadIds: newArchivedThreadIds,
            threadIdMap: {
              ...state.threadIdMap,
              ...newThreadIdMap
            },
            threadData: {
              ...state.threadData,
              ...newThreadData
            }
          };
        }
      }).then(() => {
      });
    }
    return this._loadThreadsPromise;
  }
  useProvider;
  __internal_setOptions(options) {
    if (this._options === options) return;
    this._options = options;
    const Provider = options.adapter.unstable_Provider ?? Fragment;
    if (Provider !== this.useProvider.getState().Provider) {
      this.useProvider.setState({ Provider }, true);
    }
    this._hookManager.setRuntimeHook(options.runtimeHook);
  }
  __internal_load() {
    this.getLoadThreadsPromise();
  }
  get isLoading() {
    return this._state.value.isLoading;
  }
  get threadIds() {
    return this._state.value.threadIds;
  }
  get archivedThreadIds() {
    return this._state.value.archivedThreadIds;
  }
  get newThreadId() {
    return this._state.value.newThreadId;
  }
  get mainThreadId() {
    return this._mainThreadId;
  }
  getMainThreadRuntimeCore() {
    const result = this._hookManager.getThreadRuntimeCore(this._mainThreadId);
    if (!result) return EMPTY_THREAD_CORE;
    return result;
  }
  getThreadRuntimeCore(threadIdOrRemoteId) {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    const result = this._hookManager.getThreadRuntimeCore(data.threadId);
    if (!result) throw new Error("Thread not found");
    return result;
  }
  getItemById(threadIdOrRemoteId) {
    return getThreadData(this._state.value, threadIdOrRemoteId);
  }
  async switchToThread(threadIdOrRemoteId) {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    if (this._mainThreadId === data.threadId) return;
    const task = this._hookManager.startThreadRuntime(data.threadId);
    if (this.mainThreadId !== void 0) {
      await task;
    } else {
      task.then(() => this._notifySubscribers());
    }
    if (data.status === "archived") await this.unarchive(data.threadId);
    this._mainThreadId = data.threadId;
    this._notifySubscribers();
  }
  async switchToNewThread() {
    while (this._state.baseValue.newThreadId !== void 0 && this._state.value.newThreadId === void 0) {
      await this._state.waitForUpdate();
    }
    const state = this._state.value;
    let threadId = this._state.value.newThreadId;
    if (threadId === void 0) {
      do {
        threadId = `__LOCALID_${generateId()}`;
      } while (state.threadIdMap[threadId]);
      const mappingId = createThreadMappingId(threadId);
      this._state.update({
        ...state,
        newThreadId: threadId,
        threadIdMap: {
          ...state.threadIdMap,
          [threadId]: mappingId
        },
        threadData: {
          ...state.threadData,
          [threadId]: {
            status: "new",
            threadId
          }
        }
      });
    }
    return this.switchToThread(threadId);
  }
  initialize = async (threadId) => {
    if (this._state.value.newThreadId !== threadId) {
      const data = this.getItemById(threadId);
      if (!data) throw new Error("Thread not found");
      if (data.status === "new") throw new Error("Unexpected new state");
      return data.initializeTask;
    }
    return this._state.optimisticUpdate({
      execute: () => {
        return this._options.adapter.initialize(threadId);
      },
      optimistic: (state) => {
        return updateStatusReducer(state, threadId, "regular");
      },
      loading: (state, task) => {
        const mappingId = createThreadMappingId(threadId);
        return {
          ...state,
          threadData: {
            ...state.threadData,
            [mappingId]: {
              ...state.threadData[mappingId],
              initializeTask: task
            }
          }
        };
      },
      then: (state, { remoteId, externalId }) => {
        const data = getThreadData(state, threadId);
        if (!data) return state;
        const mappingId = createThreadMappingId(threadId);
        return {
          ...state,
          threadIdMap: {
            ...state.threadIdMap,
            [remoteId]: mappingId
          },
          threadData: {
            ...state.threadData,
            [mappingId]: {
              ...data,
              initializeTask: Promise.resolve({ remoteId, externalId }),
              remoteId,
              externalId
            }
          }
        };
      }
    });
  };
  generateTitle = async (threadId) => {
    const data = this.getItemById(threadId);
    if (!data) throw new Error("Thread not found");
    if (data.status === "new") throw new Error("Thread is not yet initialized");
    const { remoteId } = await data.initializeTask;
    const runtimeCore = this._hookManager.getThreadRuntimeCore(data.threadId);
    if (!runtimeCore) return;
    const messages = runtimeCore.messages;
    const stream = await this._options.adapter.generateTitle(
      remoteId,
      messages
    );
    const messageStream = AssistantMessageStream.fromAssistantStream(stream);
    for await (const result of messageStream) {
      const newTitle = result.parts.filter((c) => c.type === "text")[0]?.text;
      const state = this._state.baseValue;
      this._state.update({
        ...state,
        threadData: {
          ...state.threadData,
          [data.threadId]: {
            ...data,
            title: newTitle
          }
        }
      });
    }
  };
  rename(threadIdOrRemoteId, newTitle) {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    if (data.status === "new") throw new Error("Thread is not yet initialized");
    return this._state.optimisticUpdate({
      execute: async () => {
        const { remoteId } = await data.initializeTask;
        return this._options.adapter.rename(remoteId, newTitle);
      },
      optimistic: (state) => {
        const data2 = getThreadData(state, threadIdOrRemoteId);
        if (!data2) return state;
        return {
          ...state,
          threadData: {
            ...state.threadData,
            [data2.threadId]: {
              ...data2,
              title: newTitle
            }
          }
        };
      }
    });
  }
  async _ensureThreadIsNotMain(threadId) {
    if (threadId === this.newThreadId)
      throw new Error("Cannot ensure new thread is not main");
    if (threadId === this._mainThreadId) {
      await this.switchToNewThread();
    }
  }
  async archive(threadIdOrRemoteId) {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    if (data.status !== "regular")
      throw new Error("Thread is not yet initialized or already archived");
    return this._state.optimisticUpdate({
      execute: async () => {
        await this._ensureThreadIsNotMain(data.threadId);
        const { remoteId } = await data.initializeTask;
        return this._options.adapter.archive(remoteId);
      },
      optimistic: (state) => {
        return updateStatusReducer(state, data.threadId, "archived");
      }
    });
  }
  unarchive(threadIdOrRemoteId) {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    if (data.status !== "archived") throw new Error("Thread is not archived");
    return this._state.optimisticUpdate({
      execute: async () => {
        try {
          const { remoteId } = await data.initializeTask;
          return await this._options.adapter.unarchive(remoteId);
        } catch (error) {
          await this._ensureThreadIsNotMain(data.threadId);
          throw error;
        }
      },
      optimistic: (state) => {
        return updateStatusReducer(state, data.threadId, "regular");
      }
    });
  }
  async delete(threadIdOrRemoteId) {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    if (data.status !== "regular" && data.status !== "archived")
      throw new Error("Thread is not yet initialized");
    return this._state.optimisticUpdate({
      execute: async () => {
        await this._ensureThreadIsNotMain(data.threadId);
        const { remoteId } = await data.initializeTask;
        return await this._options.adapter.delete(remoteId);
      },
      optimistic: (state) => {
        return updateStatusReducer(state, data.threadId, "deleted");
      }
    });
  }
  async detach(threadIdOrRemoteId) {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    if (data.status !== "regular" && data.status !== "archived")
      throw new Error("Thread is not yet initialized");
    await this._ensureThreadIsNotMain(data.threadId);
    this._hookManager.stopThreadRuntime(data.threadId);
  }
  useBoundIds = create(() => []);
  __internal_RenderComponent = () => {
    const id = useId();
    useEffect(() => {
      this.useBoundIds.setState((s) => [...s, id], true);
      return () => {
        this.useBoundIds.setState((s) => s.filter((i) => i !== id), true);
      };
    }, [id]);
    const boundIds = this.useBoundIds();
    const { Provider } = this.useProvider();
    const adapters = {
      modelContext: this.contextProvider
    };
    return (boundIds.length === 0 || boundIds[0] === id) && // only render if the component is the first one mounted
    /* @__PURE__ */ jsx(RuntimeAdapterProvider, { adapters, children: /* @__PURE__ */ jsx(
      this._hookManager.__internal_RenderThreadRuntimes,
      {
        provider: Provider
      }
    ) });
  };
};
export {
  RemoteThreadListThreadListRuntimeCore
};
//# sourceMappingURL=RemoteThreadListThreadListRuntimeCore.js.map