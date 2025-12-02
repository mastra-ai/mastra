import type { AssistantCloud } from "assistant-cloud";
import {
  Attachment,
  PendingAttachment,
  CompleteAttachment,
} from "../../../types/AttachmentTypes";
import { ThreadUserMessagePart } from "../../../types/MessagePartTypes";
import { AttachmentAdapter } from "./AttachmentAdapter";

const guessAttachmentType = (
  contentType: string,
): "image" | "document" | "file" => {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("text/")) return "document";
  return "file";
};

export class CloudFileAttachmentAdapter implements AttachmentAdapter {
  public accept = "*";

  constructor(private cloud: AssistantCloud) {}

  private uploadedUrls = new Map<string, string>();

  public async *add({
    file,
  }: {
    file: File;
  }): AsyncGenerator<PendingAttachment, void> {
    const id = crypto.randomUUID();
    const type = guessAttachmentType(file.type);
    let attachment: PendingAttachment = {
      id,
      type,
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "running", reason: "uploading", progress: 0 },
    };
    yield attachment;

    try {
      const { signedUrl, publicUrl } =
        await this.cloud.files.generatePresignedUploadUrl({
          filename: file.name,
        });
      await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
        mode: "cors",
      });
      this.uploadedUrls.set(id, publicUrl);
      attachment = {
        ...attachment,
        status: { type: "requires-action", reason: "composer-send" },
      };
      yield attachment;
    } catch {
      attachment = {
        ...attachment,
        status: { type: "incomplete", reason: "error" },
      };
      yield attachment;
    }
  }

  public async remove(attachment: Attachment): Promise<void> {
    this.uploadedUrls.delete(attachment.id);
  }

  public async send(
    attachment: PendingAttachment,
  ): Promise<CompleteAttachment> {
    const url = this.uploadedUrls.get(attachment.id);
    if (!url) throw new Error("Attachment not uploaded");
    this.uploadedUrls.delete(attachment.id);

    let content: ThreadUserMessagePart[];
    if (attachment.type === "image") {
      content = [{ type: "image", image: url, filename: attachment.name }];
    } else {
      content = [
        {
          type: "file",
          data: url,
          mimeType: attachment.contentType,
          filename: attachment.name,
        },
      ];
    }

    return {
      ...attachment,
      status: { type: "complete" },
      content,
    };
  }
}
