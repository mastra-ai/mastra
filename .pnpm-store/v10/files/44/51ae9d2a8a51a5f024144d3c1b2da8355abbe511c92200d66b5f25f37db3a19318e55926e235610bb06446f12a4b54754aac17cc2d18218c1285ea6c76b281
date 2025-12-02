import { AppendMessage, PendingAttachment } from "../../types";
import { AttachmentAdapter } from "../adapters/attachment";
import { ThreadComposerRuntimeCore } from "../core/ComposerRuntimeCore";
import { ThreadRuntimeCore } from "../core/ThreadRuntimeCore";
import { BaseComposerRuntimeCore } from "./BaseComposerRuntimeCore";
export declare class DefaultThreadComposerRuntimeCore extends BaseComposerRuntimeCore implements ThreadComposerRuntimeCore {
    private runtime;
    private _canCancel;
    get canCancel(): boolean;
    get attachments(): readonly PendingAttachment[];
    protected getAttachmentAdapter(): AttachmentAdapter | undefined;
    constructor(runtime: Omit<ThreadRuntimeCore, "composer"> & {
        adapters?: {
            attachments?: AttachmentAdapter | undefined;
        } | undefined;
    });
    connect(): import("../..").Unsubscribe;
    handleSend(message: Omit<AppendMessage, "parentId" | "sourceId">): Promise<void>;
    handleCancel(): Promise<void>;
}
//# sourceMappingURL=DefaultThreadComposerRuntimeCore.d.ts.map