import { SubscribableWithState } from "./subscribable/Subscribable";
import type { ComposerRuntimeCoreBinding } from "./RuntimeBindings";
import { Attachment, CompleteAttachment, PendingAttachment, Unsubscribe } from "../types";
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
export type AttachmentState = ThreadComposerAttachmentState | EditComposerAttachmentState | MessageAttachmentState;
type AttachmentSnapshotBinding<Source extends AttachmentRuntimeSource> = SubscribableWithState<AttachmentState & {
    source: Source;
}, AttachmentRuntimePath & {
    attachmentSource: Source;
}>;
type AttachmentRuntimeSource = AttachmentState["source"];
export type AttachmentRuntime<TSource extends AttachmentRuntimeSource = AttachmentRuntimeSource> = {
    readonly path: AttachmentRuntimePath & {
        attachmentSource: TSource;
    };
    readonly source: TSource;
    getState(): AttachmentState & {
        source: TSource;
    };
    remove(): Promise<void>;
    subscribe(callback: () => void): Unsubscribe;
};
export declare abstract class AttachmentRuntimeImpl<Source extends AttachmentRuntimeSource = AttachmentRuntimeSource> implements AttachmentRuntime {
    private _core;
    get path(): AttachmentRuntimePath & {
        attachmentSource: Source;
    };
    abstract get source(): Source;
    constructor(_core: AttachmentSnapshotBinding<Source>);
    protected __internal_bindMethods(): void;
    getState(): AttachmentState & {
        source: Source;
    };
    abstract remove(): Promise<void>;
    subscribe(callback: () => void): Unsubscribe;
}
declare abstract class ComposerAttachmentRuntime<Source extends "thread-composer" | "edit-composer"> extends AttachmentRuntimeImpl<Source> {
    private _composerApi;
    constructor(core: AttachmentSnapshotBinding<Source>, _composerApi: ComposerRuntimeCoreBinding);
    remove(): Promise<void>;
}
export declare class ThreadComposerAttachmentRuntimeImpl extends ComposerAttachmentRuntime<"thread-composer"> {
    get source(): "thread-composer";
}
export declare class EditComposerAttachmentRuntimeImpl extends ComposerAttachmentRuntime<"edit-composer"> {
    get source(): "edit-composer";
}
export declare class MessageAttachmentRuntimeImpl extends AttachmentRuntimeImpl<"message"> {
    get source(): "message";
    constructor(core: AttachmentSnapshotBinding<"message">);
    remove(): never;
}
export {};
//# sourceMappingURL=AttachmentRuntime.d.ts.map