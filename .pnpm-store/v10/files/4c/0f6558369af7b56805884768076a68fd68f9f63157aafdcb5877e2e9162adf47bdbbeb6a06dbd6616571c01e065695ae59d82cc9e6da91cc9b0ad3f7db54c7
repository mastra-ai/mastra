import { SubscribableWithState } from "./subscribable/Subscribable";

import type { ComposerRuntimeCoreBinding } from "./RuntimeBindings";
import {
  Attachment,
  CompleteAttachment,
  PendingAttachment,
  Unsubscribe,
} from "../types";
import { AttachmentRuntimePath } from "./RuntimePathTypes";

type MessageAttachmentState = CompleteAttachment & {
  readonly source: "message";
};

type ThreadComposerAttachmentState = PendingAttachment & {
  readonly source: "thread-composer";
};

type EditComposerAttachmentState = Attachment & {
  readonly source: "edit-composer";
};

export type AttachmentState =
  | ThreadComposerAttachmentState
  | EditComposerAttachmentState
  | MessageAttachmentState;

type AttachmentSnapshotBinding<Source extends AttachmentRuntimeSource> =
  SubscribableWithState<
    AttachmentState & { source: Source },
    AttachmentRuntimePath & { attachmentSource: Source }
  >;

type AttachmentRuntimeSource = AttachmentState["source"];

export type AttachmentRuntime<
  TSource extends AttachmentRuntimeSource = AttachmentRuntimeSource,
> = {
  readonly path: AttachmentRuntimePath & { attachmentSource: TSource };
  readonly source: TSource;
  getState(): AttachmentState & { source: TSource };
  remove(): Promise<void>;
  subscribe(callback: () => void): Unsubscribe;
};

export abstract class AttachmentRuntimeImpl<
  Source extends AttachmentRuntimeSource = AttachmentRuntimeSource,
> implements AttachmentRuntime
{
  public get path() {
    return this._core.path;
  }

  public abstract get source(): Source;

  constructor(private _core: AttachmentSnapshotBinding<Source>) {}

  protected __internal_bindMethods() {
    this.getState = this.getState.bind(this);
    this.remove = this.remove.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }

  public getState(): AttachmentState & { source: Source } {
    return this._core.getState();
  }

  public abstract remove(): Promise<void>;

  public subscribe(callback: () => void) {
    return this._core.subscribe(callback);
  }
}

abstract class ComposerAttachmentRuntime<
  Source extends "thread-composer" | "edit-composer",
> extends AttachmentRuntimeImpl<Source> {
  constructor(
    core: AttachmentSnapshotBinding<Source>,
    private _composerApi: ComposerRuntimeCoreBinding,
  ) {
    super(core);
  }

  public remove() {
    const core = this._composerApi.getState();
    if (!core) throw new Error("Composer is not available");
    return core.removeAttachment(this.getState().id);
  }
}

export class ThreadComposerAttachmentRuntimeImpl extends ComposerAttachmentRuntime<"thread-composer"> {
  public get source(): "thread-composer" {
    return "thread-composer";
  }
}

export class EditComposerAttachmentRuntimeImpl extends ComposerAttachmentRuntime<"edit-composer"> {
  public get source(): "edit-composer" {
    return "edit-composer";
  }
}

export class MessageAttachmentRuntimeImpl extends AttachmentRuntimeImpl<"message"> {
  public get source(): "message" {
    return "message";
  }

  constructor(core: AttachmentSnapshotBinding<"message">) {
    super(core);
  }

  public remove(): never {
    throw new Error("Message attachments cannot be removed");
  }
}
