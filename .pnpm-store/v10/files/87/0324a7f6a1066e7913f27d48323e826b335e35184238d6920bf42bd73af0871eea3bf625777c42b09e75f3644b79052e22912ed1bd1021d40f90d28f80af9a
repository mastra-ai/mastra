import { AssistantCloudAPI } from "./AssistantCloudAPI";
import { AssistantCloudThreadMessages } from "./AssistantCloudThreadMessages";

type AssistantCloudThreadsListQuery = {
  is_archived?: boolean;
  limit?: number;
  after?: string;
};

type CloudThread = {
  title: string;
  last_message_at: Date;
  metadata: unknown;
  external_id: string | null;
  id: string;
  project_id: string;
  created_at: Date;
  updated_at: Date;
  workspace_id: string;
  is_archived: boolean;
};

type AssistantCloudThreadsListResponse = {
  threads: CloudThread[];
};

type AssistantCloudThreadsCreateBody = {
  title?: string | undefined;
  last_message_at: Date;
  metadata?: unknown | undefined;
  external_id?: string | undefined;
};

type AssistantCloudThreadsCreateResponse = {
  thread_id: string;
};

type AssistantCloudThreadsUpdateBody = {
  title?: string | undefined;
  last_message_at?: Date | undefined;
  metadata?: unknown | undefined;
  is_archived?: boolean | undefined;
};

export class AssistantCloudThreads {
  public readonly messages: AssistantCloudThreadMessages;

  constructor(private cloud: AssistantCloudAPI) {
    this.messages = new AssistantCloudThreadMessages(cloud);
  }

  public async list(
    query?: AssistantCloudThreadsListQuery,
  ): Promise<AssistantCloudThreadsListResponse> {
    return this.cloud.makeRequest("/threads", { query });
  }

  public async create(
    body: AssistantCloudThreadsCreateBody,
  ): Promise<AssistantCloudThreadsCreateResponse> {
    return this.cloud.makeRequest("/threads", { method: "POST", body });
  }

  public async update(
    threadId: string,
    body: AssistantCloudThreadsUpdateBody,
  ): Promise<void> {
    return this.cloud.makeRequest(`/threads/${encodeURIComponent(threadId)}`, {
      method: "PUT",
      body,
    });
  }

  public async delete(threadId: string): Promise<void> {
    return this.cloud.makeRequest(`/threads/${encodeURIComponent(threadId)}`, {
      method: "DELETE",
    });
  }
}
