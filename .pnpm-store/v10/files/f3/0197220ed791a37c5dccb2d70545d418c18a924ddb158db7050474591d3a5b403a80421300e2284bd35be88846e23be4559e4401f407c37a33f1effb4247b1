import { Attachment, PendingAttachment } from "../../../types/AttachmentTypes";
import { AttachmentAdapter } from "./AttachmentAdapter";
export declare class CompositeAttachmentAdapter implements AttachmentAdapter {
    private _adapters;
    accept: string;
    constructor(adapters: AttachmentAdapter[]);
    add(state: {
        file: File;
    }): Promise<PendingAttachment> | AsyncGenerator<PendingAttachment, void, any>;
    send(attachment: PendingAttachment): Promise<import("../../..").CompleteAttachment>;
    remove(attachment: Attachment): Promise<void>;
}
//# sourceMappingURL=CompositeAttachmentAdapter.d.ts.map