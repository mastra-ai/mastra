// src/AssistantCloudThreadMessages.tsx
var AssistantCloudThreadMessages = class {
  constructor(cloud) {
    this.cloud = cloud;
  }
  async list(threadId, query) {
    return this.cloud.makeRequest(
      `/threads/${encodeURIComponent(threadId)}/messages`,
      { query }
    );
  }
  async create(threadId, body) {
    return this.cloud.makeRequest(
      `/threads/${encodeURIComponent(threadId)}/messages`,
      { method: "POST", body }
    );
  }
};
export {
  AssistantCloudThreadMessages
};
//# sourceMappingURL=AssistantCloudThreadMessages.js.map