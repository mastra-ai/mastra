import { ReadonlyJSONObject } from "assistant-stream/utils";
import { AssistantCloudAPI } from "./AssistantCloudAPI";

export type CloudMessage = {
  id: string;
  parent_id: string | null;
  height: number;
  created_at: Date;
  updated_at: Date;
  format: "aui/v0" | string;
  content: ReadonlyJSONObject;
};

type AssistantCloudThreadMessageListQuery = {
  format?: string;
};

type AssistantCloudThreadMessageListResponse = {
  messages: CloudMessage[];
};

type AssistantCloudThreadMessageCreateBody = {
  parent_id: string | null;
  format: "aui/v0" | string;
  content: ReadonlyJSONObject;
};

type AssistantCloudMessageCreateResponse = {
  message_id: string;
};

export class AssistantCloudThreadMessages {
  constructor(private cloud: AssistantCloudAPI) {}

  public async list(
    threadId: string,
    query?: AssistantCloudThreadMessageListQuery,
  ): Promise<AssistantCloudThreadMessageListResponse> {
    return this.cloud.makeRequest(
      `/threads/${encodeURIComponent(threadId)}/messages`,
      { query },
    );
  }

  public async create(
    threadId: string,
    body: AssistantCloudThreadMessageCreateBody,
  ): Promise<AssistantCloudMessageCreateResponse> {
    return this.cloud.makeRequest(
      `/threads/${encodeURIComponent(threadId)}/messages`,
      { method: "POST", body },
    );
  }
}
