import { ThreadListRuntimeCore } from "../core/ThreadListRuntimeCore";
import { BaseSubscribable } from "../remote-thread-list/BaseSubscribable";
import { LocalThreadRuntimeCore } from "./LocalThreadRuntimeCore";

export type LocalThreadFactory = () => LocalThreadRuntimeCore;

const EMPTY_ARRAY = Object.freeze([]);
export class LocalThreadListRuntimeCore
  extends BaseSubscribable
  implements ThreadListRuntimeCore
{
  private _mainThread: LocalThreadRuntimeCore;
  constructor(_threadFactory: LocalThreadFactory) {
    super();

    this._mainThread = _threadFactory();
  }

  public get isLoading() {
    return false;
  }

  public getMainThreadRuntimeCore() {
    return this._mainThread;
  }

  public get newThreadId(): string {
    throw new Error("Method not implemented.");
  }

  public get threadIds(): readonly string[] {
    throw EMPTY_ARRAY;
  }

  public get archivedThreadIds(): readonly string[] {
    throw EMPTY_ARRAY;
  }

  public get mainThreadId(): string {
    return "__DEFAULT_ID__";
  }

  public getThreadRuntimeCore(): never {
    throw new Error("Method not implemented.");
  }

  public getLoadThreadsPromise(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public getItemById(threadId: string) {
    if (threadId === this.mainThreadId) {
      return {
        status: "regular" as const,
        threadId: this.mainThreadId,
        remoteId: this.mainThreadId,
        externalId: undefined,
        title: undefined,
        isMain: true,
      };
    }
    throw new Error("Method not implemented");
  }

  public async switchToThread(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public switchToNewThread(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public rename(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public archive(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public detach(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public unarchive(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public initialize(): never {
    throw new Error("Method not implemented.");
  }

  public generateTitle(): never {
    throw new Error("Method not implemented.");
  }
}
