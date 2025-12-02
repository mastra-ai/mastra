// src/AssistantCloudFiles.tsx
var AssistantCloudFiles = class {
  constructor(cloud) {
    this.cloud = cloud;
  }
  async pdfToImages(body) {
    return this.cloud.makeRequest("/files/pdf-to-images", {
      method: "POST",
      body
    });
  }
  async generatePresignedUploadUrl(body) {
    return this.cloud.makeRequest(
      "/files/attachments/generate-presigned-upload-url",
      {
        method: "POST",
        body
      }
    );
  }
};
export {
  AssistantCloudFiles
};
//# sourceMappingURL=AssistantCloudFiles.js.map