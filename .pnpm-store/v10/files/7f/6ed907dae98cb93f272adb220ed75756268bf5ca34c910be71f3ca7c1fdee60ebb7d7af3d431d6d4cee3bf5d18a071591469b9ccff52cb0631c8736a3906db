import type { Unsubscribe } from "../../types";
import { ExternalStoreThreadRuntimeCore } from "./ExternalStoreThreadRuntimeCore";
import { ThreadListRuntimeCore } from "../core/ThreadListRuntimeCore";
import {
  ExternalStoreThreadData,
  ExternalStoreThreadListAdapter,
} from "./ExternalStoreAdapter";

export type ExternalStoreThreadFactory = () => ExternalStoreThreadRuntimeCore;

const EMPTY_ARRAY = Object.freeze([]);
const DEFAULT_THREAD_ID = "DEFAULT_THREAD_ID";
const DEFAULT_THREADS = Object.freeze([DEFAULT_THREAD_ID]);
const DEFAULT_THREAD: ExternalStoreThreadData<"regular"> = Object.freeze({
  threadId: DEFAULT_THREAD_ID,
  status: "regular",
});
const RESOLVED_PROMISE = Promise.resolve();

export class ExternalStoreThreadListRuntimeCore
  implements ThreadListRuntimeCore
{
  private _mainThreadId: string = DEFAULT_THREAD_ID;
  private _threads: readonly string[] = DEFAULT_THREADS;
  private _archivedThreads: readonly string[] = EMPTY_ARRAY;

  public get isLoading() {
    return this.adapter.isLoading ?? false;
  }

  public get newThreadId() {
    return undefined;
  }

  public get threadIds() {
    return this._threads;
  }

  public get archivedThreadIds() {
    return this._archivedThreads;
  }

  public getLoadThreadsPromise() {
    return RESOLVED_PROMISE;
  }

  private _mainThread: ExternalStoreThreadRuntimeCore;

  public get mainThreadId() {
    return this._mainThreadId;
  }

  constructor(
    private adapter: ExternalStoreThreadListAdapter = {},
    private threadFactory: ExternalStoreThreadFactory,
  ) {
    this._mainThread = this.threadFactory();
  }

  public getMainThreadRuntimeCore() {
    return this._mainThread;
  }

  public getThreadRuntimeCore(): never {
    throw new Error("Method not implemented.");
  }

  public getItemById(threadId: string) {
    for (const thread of this.adapter.threads ?? []) {
      if (thread.threadId === threadId) return thread;
    }
    for (const thread of this.adapter.archivedThreads ?? []) {
      if (thread.threadId === threadId) return thread;
    }
    if (threadId === DEFAULT_THREAD_ID) return DEFAULT_THREAD;
    return undefined;
  }

  public __internal_setAdapter(adapter: ExternalStoreThreadListAdapter) {
    const previousAdapter = this.adapter;
    this.adapter = adapter;

    const newThreadId = adapter.threadId ?? DEFAULT_THREAD_ID;
    const newThreads = adapter.threads ?? EMPTY_ARRAY;
    const newArchivedThreads = adapter.archivedThreads ?? EMPTY_ARRAY;

    const previousThreadId = previousAdapter.threadId ?? DEFAULT_THREAD_ID;
    const previousThreads = previousAdapter.threads ?? EMPTY_ARRAY;
    const previousArchivedThreads =
      previousAdapter.archivedThreads ?? EMPTY_ARRAY;

    if (
      previousThreadId === newThreadId &&
      previousThreads === newThreads &&
      previousArchivedThreads === newArchivedThreads
    ) {
      return;
    }

    if (previousThreads !== newThreads) {
      this._threads =
        this.adapter.threads?.map((t) => t.threadId) ?? EMPTY_ARRAY;
    }

    if (previousArchivedThreads !== newArchivedThreads) {
      this._archivedThreads =
        this.adapter.archivedThreads?.map((t) => t.threadId) ?? EMPTY_ARRAY;
    }

    if (previousThreadId !== newThreadId) {
      this._mainThreadId = newThreadId;
      this._mainThread = this.threadFactory();
    }

    this._notifySubscribers();
  }

  public async switchToThread(threadId: string): Promise<void> {
    if (this._mainThreadId === threadId) return;
    const onSwitchToThread = this.adapter.onSwitchToThread;
    if (!onSwitchToThread)
      throw new Error(
        "External store adapter does not support switching to thread",
      );
    onSwitchToThread(threadId);
  }

  public async switchToNewThread(): Promise<void> {
    const onSwitchToNewThread = this.adapter.onSwitchToNewThread;
    if (!onSwitchToNewThread)
      throw new Error(
        "External store adapter does not support switching to new thread",
      );

    onSwitchToNewThread();
  }

  public async rename(threadId: string, newTitle: string): Promise<void> {
    const onRename = this.adapter.onRename;
    if (!onRename)
      throw new Error("External store adapter does not support renaming");

    onRename(threadId, newTitle);
  }

  public async detach(): Promise<void> {
    // no-op
  }

  public async archive(threadId: string): Promise<void> {
    const onArchive = this.adapter.onArchive;
    if (!onArchive)
      throw new Error("External store adapter does not support archiving");

    onArchive(threadId);
  }

  public async unarchive(threadId: string): Promise<void> {
    const onUnarchive = this.adapter.onUnarchive;
    if (!onUnarchive)
      throw new Error("External store adapter does not support unarchiving");

    onUnarchive(threadId);
  }

  public async delete(threadId: string): Promise<void> {
    const onDelete = this.adapter.onDelete;
    if (!onDelete)
      throw new Error("External store adapter does not support deleting");

    onDelete(threadId);
  }

  public initialize(): never {
    throw new Error("Method not implemented.");
  }

  public generateTitle(): never {
    throw new Error("Method not implemented.");
  }

  private _subscriptions = new Set<() => void>();

  public subscribe(callback: () => void): Unsubscribe {
    this._subscriptions.add(callback);
    return () => this._subscriptions.delete(callback);
  }

  private _notifySubscribers() {
    for (const callback of this._subscriptions) callback();
  }
}
