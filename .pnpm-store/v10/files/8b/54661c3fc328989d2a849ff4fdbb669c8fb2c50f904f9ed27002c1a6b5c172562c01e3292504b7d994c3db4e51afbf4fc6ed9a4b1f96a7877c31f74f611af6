// src/AssistantCloudRuns.tsx
import { AssistantStream, PlainTextDecoder } from "assistant-stream";
var AssistantCloudRuns = class {
  constructor(cloud) {
    this.cloud = cloud;
  }
  __internal_getAssistantOptions(assistantId) {
    return {
      api: this.cloud._baseUrl + "/v1/runs/stream",
      headers: async () => {
        const headers = await this.cloud._auth.getAuthHeaders();
        if (!headers) throw new Error("Authorization failed");
        return {
          ...headers,
          Accept: "text/plain"
        };
      },
      body: {
        assistant_id: assistantId,
        response_format: "vercel-ai-data-stream/v1",
        thread_id: "unstable_todo"
      }
    };
  }
  async stream(body) {
    const response = await this.cloud.makeRawRequest("/runs/stream", {
      method: "POST",
      headers: {
        Accept: "text/plain"
      },
      body
    });
    return AssistantStream.fromResponse(response, new PlainTextDecoder());
  }
};
export {
  AssistantCloudRuns
};
//# sourceMappingURL=AssistantCloudRuns.js.map