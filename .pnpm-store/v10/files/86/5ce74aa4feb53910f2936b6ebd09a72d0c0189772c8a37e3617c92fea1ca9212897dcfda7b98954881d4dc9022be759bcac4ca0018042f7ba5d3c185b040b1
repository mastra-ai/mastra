import { AssistantCloudAPI } from "./AssistantCloudAPI";
import { AssistantStream, PlainTextDecoder } from "assistant-stream";

type AssistantCloudRunsStreamBody = {
  thread_id: string;
  assistant_id: "system/thread_title";
  messages: readonly unknown[]; // TODO type
};

export class AssistantCloudRuns {
  constructor(private cloud: AssistantCloudAPI) {}

  public __internal_getAssistantOptions(assistantId: string) {
    return {
      api: this.cloud._baseUrl + "/v1/runs/stream",
      headers: async () => {
        const headers = await this.cloud._auth.getAuthHeaders();
        if (!headers) throw new Error("Authorization failed");
        return {
          ...headers,
          Accept: "text/plain",
        };
      },
      body: {
        assistant_id: assistantId,
        response_format: "vercel-ai-data-stream/v1",
        thread_id: "unstable_todo",
      },
    };
  }

  public async stream(
    body: AssistantCloudRunsStreamBody,
  ): Promise<AssistantStream> {
    const response = await this.cloud.makeRawRequest("/runs/stream", {
      method: "POST",
      headers: {
        Accept: "text/plain",
      },
      body,
    });
    return AssistantStream.fromResponse(response, new PlainTextDecoder());
  }
}
