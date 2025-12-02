import { Unsubscribe } from "../types";
import { ThreadListItemRuntimePath } from "./RuntimePathTypes";
import { SubscribableWithState } from "./subscribable/Subscribable";
import { ThreadListRuntimeCoreBinding } from "./ThreadListRuntime";

export type ThreadListItemEventType = "switched-to" | "switched-away";

import type {
  ThreadListItemState,
  ThreadListItemStatus,
} from "./RuntimeBindings";

export type { ThreadListItemState, ThreadListItemStatus };

export type ThreadListItemRuntime = {
  readonly path: ThreadListItemRuntimePath;
  getState(): ThreadListItemState;

  initialize(): Promise<{ remoteId: string; externalId: string | undefined }>;
  generateTitle(): Promise<void>;

  switchTo(): Promise<void>;
  rename(newTitle: string): Promise<void>;
  archive(): Promise<void>;
  unarchive(): Promise<void>;
  delete(): Promise<void>;

  /**
   * Detaches the ThreadListItem instance, unmounting the ThreadRuntime hook.
   */
  detach(): void;

  subscribe(callback: () => void): Unsubscribe;

  unstable_on(
    event: ThreadListItemEventType,
    callback: () => void,
  ): Unsubscribe;
};

export type ThreadListItemStateBinding = SubscribableWithState<
  ThreadListItemState,
  ThreadListItemRuntimePath
>;

export class ThreadListItemRuntimeImpl implements ThreadListItemRuntime {
  public get path() {
    return this._core.path;
  }

  constructor(
    private _core: ThreadListItemStateBinding,
    private _threadListBinding: ThreadListRuntimeCoreBinding,
  ) {}

  protected __internal_bindMethods() {
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

  public getState(): ThreadListItemState {
    return this._core.getState();
  }

  public switchTo(): Promise<void> {
    const state = this._core.getState();
    return this._threadListBinding.switchToThread(state.id);
  }

  public rename(newTitle: string): Promise<void> {
    const state = this._core.getState();

    return this._threadListBinding.rename(state.id, newTitle);
  }

  public archive(): Promise<void> {
    const state = this._core.getState();

    return this._threadListBinding.archive(state.id);
  }

  public unarchive(): Promise<void> {
    const state = this._core.getState();

    return this._threadListBinding.unarchive(state.id);
  }

  public delete(): Promise<void> {
    const state = this._core.getState();

    return this._threadListBinding.delete(state.id);
  }

  public initialize(): Promise<{
    remoteId: string;
    externalId: string | undefined;
  }> {
    const state = this._core.getState();
    return this._threadListBinding.initialize(state.id);
  }

  public generateTitle(): Promise<void> {
    const state = this._core.getState();
    return this._threadListBinding.generateTitle(state.id);
  }

  public unstable_on(event: ThreadListItemEventType, callback: () => void) {
    // if the runtime is bound to a specific thread, trigger if isMain is toggled
    // if the runtime is bound to the main thread, trigger switched-to if threadId changes

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

  public subscribe(callback: () => void): Unsubscribe {
    return this._core.subscribe(callback);
  }

  public detach(): void {
    const state = this._core.getState();

    this._threadListBinding.detach(state.id);
  }
}
