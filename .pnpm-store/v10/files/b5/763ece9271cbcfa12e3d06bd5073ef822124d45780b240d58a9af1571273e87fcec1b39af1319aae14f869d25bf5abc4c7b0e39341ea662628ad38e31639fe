"use client";

import { ThreadListRuntimeCore } from "../core/ThreadListRuntimeCore";
import { generateId } from "../../internal";
import {
  RemoteThreadInitializeResponse,
  RemoteThreadListOptions,
} from "./types";
import { RemoteThreadListHookInstanceManager } from "./RemoteThreadListHookInstanceManager";
import { BaseSubscribable } from "./BaseSubscribable";
import { EMPTY_THREAD_CORE } from "./EMPTY_THREAD_CORE";
import { OptimisticState } from "./OptimisticState";
import { FC, Fragment, useEffect, useId } from "react";
import { create } from "zustand";
import { AssistantMessageStream } from "assistant-stream";
import { ModelContextProvider } from "../../model-context";
import { RuntimeAdapterProvider } from "../adapters/RuntimeAdapterProvider";

type RemoteThreadData =
  | {
      readonly threadId: string;
      readonly remoteId?: undefined;
      readonly externalId?: undefined;
      readonly status: "new";
      readonly title: undefined;
    }
  | {
      readonly threadId: string;
      readonly initializeTask: Promise<RemoteThreadInitializeResponse>;
      readonly remoteId?: undefined;
      readonly externalId?: undefined;
      readonly status: "regular" | "archived";
      readonly title?: string | undefined;
    }
  | {
      readonly threadId: string;
      readonly initializeTask: Promise<RemoteThreadInitializeResponse>;
      readonly remoteId: string;
      readonly externalId: string | undefined;
      readonly status: "regular" | "archived";
      readonly title?: string | undefined;
    };

type THREAD_MAPPING_ID = string & { __brand: "THREAD_MAPPING_ID" };
function createThreadMappingId(id: string): THREAD_MAPPING_ID {
  return id as THREAD_MAPPING_ID;
}

type RemoteThreadState = {
  readonly isLoading: boolean;
  readonly newThreadId: string | undefined;
  readonly threadIds: readonly string[];
  readonly archivedThreadIds: readonly string[];
  readonly threadIdMap: Readonly<Record<string, THREAD_MAPPING_ID>>;
  readonly threadData: Readonly<Record<THREAD_MAPPING_ID, RemoteThreadData>>;
};

const getThreadData = (
  state: RemoteThreadState,
  threadIdOrRemoteId: string,
) => {
  const idx = state.threadIdMap[threadIdOrRemoteId];
  if (idx === undefined) return undefined;
  return state.threadData[idx];
};

const updateStatusReducer = (
  state: RemoteThreadState,
  threadIdOrRemoteId: string,
  newStatus: "regular" | "archived" | "deleted",
) => {
  const data = getThreadData(state, threadIdOrRemoteId);
  if (!data) return state;

  const { threadId, remoteId, status: lastStatus } = data;
  if (lastStatus === newStatus) return state;

  const newState = { ...state };

  // lastStatus
  switch (lastStatus) {
    case "new":
      newState.newThreadId = undefined;
      break;
    case "regular":
      newState.threadIds = newState.threadIds.filter((t) => t !== threadId);
      break;
    case "archived":
      newState.archivedThreadIds = newState.archivedThreadIds.filter(
        (t) => t !== threadId,
      );
      break;

    default: {
      const _exhaustiveCheck: never = lastStatus;
      throw new Error(`Unsupported state: ${_exhaustiveCheck}`);
    }
  }

  // newStatus
  switch (newStatus) {
    case "regular":
      newState.threadIds = [threadId, ...newState.threadIds];
      break;

    case "archived":
      newState.archivedThreadIds = [threadId, ...newState.archivedThreadIds];
      break;

    case "deleted":
      newState.threadData = Object.fromEntries(
        Object.entries(newState.threadData).filter(([key]) => key !== threadId),
      );
      newState.threadIdMap = Object.fromEntries(
        Object.entries(newState.threadIdMap).filter(
          ([key]) => key !== threadId && key !== remoteId,
        ),
      );
      break;

    default: {
      const _exhaustiveCheck: never = newStatus;
      throw new Error(`Unsupported state: ${_exhaustiveCheck}`);
    }
  }

  if (newStatus !== "deleted") {
    newState.threadData = {
      ...newState.threadData,
      [threadId]: {
        ...data,
        status: newStatus,
      },
    };
  }

  return newState;
};

export class RemoteThreadListThreadListRuntimeCore
  extends BaseSubscribable
  implements ThreadListRuntimeCore
{
  private _options!: RemoteThreadListOptions;
  private readonly _hookManager: RemoteThreadListHookInstanceManager;

  private _loadThreadsPromise: Promise<void> | undefined;

  private _mainThreadId!: string;
  private readonly _state = new OptimisticState<RemoteThreadState>({
    isLoading: false,
    newThreadId: undefined,
    threadIds: [],
    archivedThreadIds: [],
    threadIdMap: {},
    threadData: {},
  });

  public getLoadThreadsPromise() {
    // TODO this needs to be cached in case this promise is loaded during suspense
    if (!this._loadThreadsPromise) {
      this._loadThreadsPromise = this._state
        .optimisticUpdate({
          execute: () => this._options.adapter.list(),
          loading: (state) => {
            return {
              ...state,
              isLoading: true,
            };
          },
          then: (state, l) => {
            const newThreadIds = [];
            const newArchivedThreadIds = [];
            const newThreadIdMap = {} as Record<string, THREAD_MAPPING_ID>;
            const newThreadData = {} as Record<
              THREAD_MAPPING_ID,
              RemoteThreadData
            >;

            for (const thread of l.threads) {
              switch (thread.status) {
                case "regular":
                  newThreadIds.push(thread.remoteId);
                  break;
                case "archived":
                  newArchivedThreadIds.push(thread.remoteId);
                  break;
                default: {
                  const _exhaustiveCheck: never = thread.status;
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
                  externalId: thread.externalId,
                }),
              };
            }

            return {
              ...state,
              threadIds: newThreadIds,
              archivedThreadIds: newArchivedThreadIds,
              threadIdMap: {
                ...state.threadIdMap,
                ...newThreadIdMap,
              },
              threadData: {
                ...state.threadData,
                ...newThreadData,
              },
            };
          },
        })
        .then(() => {});
    }

    return this._loadThreadsPromise;
  }

  constructor(
    options: RemoteThreadListOptions,
    private readonly contextProvider: ModelContextProvider,
  ) {
    super();

    this._state.subscribe(() => this._notifySubscribers());
    this._hookManager = new RemoteThreadListHookInstanceManager(
      options.runtimeHook,
    );
    this.useProvider = create(() => ({
      Provider: options.adapter.unstable_Provider ?? Fragment,
    }));
    this.__internal_setOptions(options);

    this.switchToNewThread();
  }

  private useProvider;

  public __internal_setOptions(options: RemoteThreadListOptions) {
    if (this._options === options) return;

    this._options = options;

    const Provider = options.adapter.unstable_Provider ?? Fragment;
    if (Provider !== this.useProvider.getState().Provider) {
      this.useProvider.setState({ Provider }, true);
    }

    this._hookManager.setRuntimeHook(options.runtimeHook);
  }

  public __internal_load() {
    this.getLoadThreadsPromise(); // begin loading on initial bind
  }

  public get isLoading() {
    return this._state.value.isLoading;
  }

  public get threadIds() {
    return this._state.value.threadIds;
  }

  public get archivedThreadIds() {
    return this._state.value.archivedThreadIds;
  }

  public get newThreadId() {
    return this._state.value.newThreadId;
  }

  public get mainThreadId(): string {
    return this._mainThreadId;
  }

  public getMainThreadRuntimeCore() {
    const result = this._hookManager.getThreadRuntimeCore(this._mainThreadId);
    if (!result) return EMPTY_THREAD_CORE;
    return result;
  }

  public getThreadRuntimeCore(threadIdOrRemoteId: string) {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");

    const result = this._hookManager.getThreadRuntimeCore(data.threadId);
    if (!result) throw new Error("Thread not found");
    return result;
  }

  public getItemById(threadIdOrRemoteId: string) {
    return getThreadData(this._state.value, threadIdOrRemoteId);
  }

  public async switchToThread(threadIdOrRemoteId: string): Promise<void> {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");

    if (this._mainThreadId === data.threadId) return;

    const task = this._hookManager.startThreadRuntime(data.threadId);
    if (this.mainThreadId !== undefined) {
      await task;
    } else {
      task.then(() => this._notifySubscribers());
    }

    if (data.status === "archived") await this.unarchive(data.threadId);
    this._mainThreadId = data.threadId;

    this._notifySubscribers();
  }

  public async switchToNewThread(): Promise<void> {
    // an initialization transaction is in progress, wait for it to settle
    while (
      this._state.baseValue.newThreadId !== undefined &&
      this._state.value.newThreadId === undefined
    ) {
      await this._state.waitForUpdate();
    }

    const state = this._state.value;
    let threadId: string | undefined = this._state.value.newThreadId;
    if (threadId === undefined) {
      do {
        threadId = `__LOCALID_${generateId()}`;
      } while (state.threadIdMap[threadId]);

      const mappingId = createThreadMappingId(threadId);
      this._state.update({
        ...state,
        newThreadId: threadId,
        threadIdMap: {
          ...state.threadIdMap,
          [threadId]: mappingId,
        },
        threadData: {
          ...state.threadData,
          [threadId]: {
            status: "new",
            threadId,
          },
        },
      });
    }

    return this.switchToThread(threadId);
  }

  public initialize = async (threadId: string) => {
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
              initializeTask: task,
            },
          },
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
            [remoteId]: mappingId,
          },
          threadData: {
            ...state.threadData,
            [mappingId]: {
              ...data,
              initializeTask: Promise.resolve({ remoteId, externalId }),
              remoteId,
              externalId,
            },
          },
        };
      },
    });
  };

  public generateTitle = async (threadId: string) => {
    const data = this.getItemById(threadId);
    if (!data) throw new Error("Thread not found");
    if (data.status === "new") throw new Error("Thread is not yet initialized");

    const { remoteId } = await data.initializeTask;

    const runtimeCore = this._hookManager.getThreadRuntimeCore(data.threadId);
    if (!runtimeCore) return; // thread is no longer running

    const messages = runtimeCore.messages;
    const stream = await this._options.adapter.generateTitle(
      remoteId,
      messages,
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
            title: newTitle,
          },
        },
      });
    }
  };

  public rename(threadIdOrRemoteId: string, newTitle: string): Promise<void> {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    if (data.status === "new") throw new Error("Thread is not yet initialized");

    return this._state.optimisticUpdate({
      execute: async () => {
        const { remoteId } = await data.initializeTask;
        return this._options.adapter.rename(remoteId, newTitle);
      },
      optimistic: (state) => {
        const data = getThreadData(state, threadIdOrRemoteId);
        if (!data) return state;

        return {
          ...state,
          threadData: {
            ...state.threadData,
            [data.threadId]: {
              ...data,
              title: newTitle,
            },
          },
        };
      },
    });
  }

  private async _ensureThreadIsNotMain(threadId: string) {
    if (threadId === this.newThreadId)
      throw new Error("Cannot ensure new thread is not main");

    if (threadId === this._mainThreadId) {
      await this.switchToNewThread();
    }
  }

  public async archive(threadIdOrRemoteId: string) {
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
      },
    });
  }

  public unarchive(threadIdOrRemoteId: string): Promise<void> {
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
      },
    });
  }

  public async delete(threadIdOrRemoteId: string) {
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
      },
    });
  }

  public async detach(threadIdOrRemoteId: string): Promise<void> {
    const data = this.getItemById(threadIdOrRemoteId);
    if (!data) throw new Error("Thread not found");
    if (data.status !== "regular" && data.status !== "archived")
      throw new Error("Thread is not yet initialized");

    await this._ensureThreadIsNotMain(data.threadId);
    this._hookManager.stopThreadRuntime(data.threadId);
  }

  private useBoundIds = create<string[]>(() => []);

  public __internal_RenderComponent: FC = () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const id = useId();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      this.useBoundIds.setState((s) => [...s, id], true);
      return () => {
        this.useBoundIds.setState((s) => s.filter((i) => i !== id), true);
      };
    }, [id]);

    const boundIds = this.useBoundIds();
    const { Provider } = this.useProvider();

    const adapters = {
      modelContext: this.contextProvider,
    };

    return (
      (boundIds.length === 0 || boundIds[0] === id) && (
        // only render if the component is the first one mounted
        <RuntimeAdapterProvider adapters={adapters}>
          <this._hookManager.__internal_RenderThreadRuntimes
            provider={Provider}
          />
        </RuntimeAdapterProvider>
      )
    );
  };
}
