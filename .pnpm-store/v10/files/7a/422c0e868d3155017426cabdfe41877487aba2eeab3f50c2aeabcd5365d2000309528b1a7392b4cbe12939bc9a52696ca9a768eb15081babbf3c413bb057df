// src/AssistantCloudThreads.tsx
import { AssistantCloudThreadMessages } from "./AssistantCloudThreadMessages.js";
var AssistantCloudThreads = class {
  constructor(cloud) {
    this.cloud = cloud;
    this.messages = new AssistantCloudThreadMessages(cloud);
  }
  messages;
  async list(query) {
    return this.cloud.makeRequest("/threads", { query });
  }
  async create(body) {
    return this.cloud.makeRequest("/threads", { method: "POST", body });
  }
  async update(threadId, body) {
    return this.cloud.makeRequest(`/threads/${encodeURIComponent(threadId)}`, {
      method: "PUT",
      body
    });
  }
  async delete(threadId) {
    return this.cloud.makeRequest(`/threads/${encodeURIComponent(threadId)}`, {
      method: "DELETE"
    });
  }
};
export {
  AssistantCloudThreads
};
//# sourceMappingURL=AssistantCloudThreads.js.map