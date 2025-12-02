import type { AssistantCloud } from "assistant-cloud";
import { Attachment, PendingAttachment, CompleteAttachment } from "../../../types/AttachmentTypes";
import { AttachmentAdapter } from "./AttachmentAdapter";
export declare class CloudFileAttachmentAdapter implements AttachmentAdapter {
    private cloud;
    accept: string;
    constructor(cloud: AssistantCloud);
    private uploadedUrls;
    add({ file, }: {
        file: File;
    }): AsyncGenerator<PendingAttachment, void>;
    remove(attachment: Attachment): Promise<void>;
    send(attachment: PendingAttachment): Promise<CompleteAttachment>;
}
//# sourceMappingURL=CloudFileAttachmentAdapter.d.ts.map