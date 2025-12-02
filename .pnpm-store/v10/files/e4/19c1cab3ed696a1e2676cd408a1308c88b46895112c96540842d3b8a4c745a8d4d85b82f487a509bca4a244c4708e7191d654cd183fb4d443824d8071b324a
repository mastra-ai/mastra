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
export declare class AssistantCloudThreads {
    private cloud;
    readonly messages: AssistantCloudThreadMessages;
    constructor(cloud: AssistantCloudAPI);
    list(query?: AssistantCloudThreadsListQuery): Promise<AssistantCloudThreadsListResponse>;
    create(body: AssistantCloudThreadsCreateBody): Promise<AssistantCloudThreadsCreateResponse>;
    update(threadId: string, body: AssistantCloudThreadsUpdateBody): Promise<void>;
    delete(threadId: string): Promise<void>;
}
export {};
//# sourceMappingURL=AssistantCloudThreads.d.ts.map