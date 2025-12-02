// src/runtimes/adapters/attachment/CloudFileAttachmentAdapter.ts
var guessAttachmentType = (contentType) => {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("text/")) return "document";
  return "file";
};
var CloudFileAttachmentAdapter = class {
  constructor(cloud) {
    this.cloud = cloud;
  }
  accept = "*";
  uploadedUrls = /* @__PURE__ */ new Map();
  async *add({
    file
  }) {
    const id = crypto.randomUUID();
    const type = guessAttachmentType(file.type);
    let attachment = {
      id,
      type,
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "running", reason: "uploading", progress: 0 }
    };
    yield attachment;
    try {
      const { signedUrl, publicUrl } = await this.cloud.files.generatePresignedUploadUrl({
        filename: file.name
      });
      await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type
        },
        mode: "cors"
      });
      this.uploadedUrls.set(id, publicUrl);
      attachment = {
        ...attachment,
        status: { type: "requires-action", reason: "composer-send" }
      };
      yield attachment;
    } catch {
      attachment = {
        ...attachment,
        status: { type: "incomplete", reason: "error" }
      };
      yield attachment;
    }
  }
  async remove(attachment) {
    this.uploadedUrls.delete(attachment.id);
  }
  async send(attachment) {
    const url = this.uploadedUrls.get(attachment.id);
    if (!url) throw new Error("Attachment not uploaded");
    this.uploadedUrls.delete(attachment.id);
    let content;
    if (attachment.type === "image") {
      content = [{ type: "image", image: url, filename: attachment.name }];
    } else {
      content = [
        {
          type: "file",
          data: url,
          mimeType: attachment.contentType,
          filename: attachment.name
        }
      ];
    }
    return {
      ...attachment,
      status: { type: "complete" },
      content
    };
  }
};
export {
  CloudFileAttachmentAdapter
};
//# sourceMappingURL=CloudFileAttachmentAdapter.js.map