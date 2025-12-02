import { AppendMessage, ThreadMessage } from "../../types";
import { AttachmentAdapter } from "../adapters/attachment";
import { ThreadRuntimeCore } from "../core/ThreadRuntimeCore";
import { BaseComposerRuntimeCore } from "./BaseComposerRuntimeCore";
export declare class DefaultEditComposerRuntimeCore extends BaseComposerRuntimeCore {
    private runtime;
    private endEditCallback;
    get canCancel(): boolean;
    protected getAttachmentAdapter(): AttachmentAdapter | undefined;
    private _nonTextParts;
    private _previousText;
    private _parentId;
    private _sourceId;
    constructor(runtime: ThreadRuntimeCore & {
        adapters?: {
            attachments?: AttachmentAdapter | undefined;
        } | undefined;
    }, endEditCallback: () => void, { parentId, message }: {
        parentId: string | null;
        message: ThreadMessage;
    });
    handleSend(message: Omit<AppendMessage, "parentId" | "sourceId">): Promise<void>;
    handleCancel(): void;
}
//# sourceMappingURL=DefaultEditComposerRuntimeCore.d.ts.map