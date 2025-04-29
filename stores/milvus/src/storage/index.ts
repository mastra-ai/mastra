import { MastraStorage } from '@mastra/core';
import type {
  StorageColumn,
  EvalRow,
  MessageType,
  StorageGetMessagesArg,
  StorageThreadType,
  WorkflowRuns,
} from '@mastra/core';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import type { CheckHealthResponse, ClientConfig } from '@zilliz/milvus2-sdk-node';

export class MilvusStorage extends MastraStorage {
  private client: MilvusClient;

  constructor(
    name: string,
    addressOrConfig: ClientConfig | string,
    ssl?: boolean,
    username?: string,
    password?: string,
  ) {
    try {
      super({ name });
      this.client = new MilvusClient(addressOrConfig, ssl, username, password);
      return this;
    } catch (error) {
      throw new Error('Failed to initialize Milvus client: ' + error);
    }
  }

  checkHealth(): Promise<CheckHealthResponse> {
    return this.client.checkHealth();
  }

  createTable({ tableName, schema }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    throw new Error(`Method not implemented. ${tableName}, ${JSON.stringify(schema)}`);
  }

  clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    throw new Error(`Method not implemented. ${tableName}`);
  }
  insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    throw new Error(`Method not implemented. ${tableName}, ${JSON.stringify(record)}`);
  }
  batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    throw new Error(`Method not implemented. ${tableName}, ${JSON.stringify(records)}`);
  }

  load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    throw new Error(`Method not implemented. ${tableName}, ${JSON.stringify(keys)}`);
  }
  getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    throw new Error(`Method not implemented. ${threadId}`);
  }
  getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    throw new Error(`Method not implemented. ${resourceId}`);
  }
  saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    throw new Error(`Method not implemented. ${JSON.stringify(thread)}`);
  }
  updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    throw new Error(`Method not implemented. ${id}, ${title}, ${JSON.stringify(metadata)}`);
  }
  deleteThread({ threadId }: { threadId: string }): Promise<void> {
    throw new Error(`Method not implemented. ${threadId}`);
  }
  getMessages({ threadId, selectBy, threadConfig }: StorageGetMessagesArg): Promise<MessageType[]> {
    throw new Error(`Method not implemented. ${threadId}, ${selectBy}, ${JSON.stringify(threadConfig)}`);
  }
  saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    throw new Error(`Method not implemented. ${JSON.stringify(messages)}`);
  }
  getTraces({
    name,
    scope,
    page,
    perPage,
    attributes,
    filters,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
  }): Promise<any[]> {
    throw new Error(
      `Method not implemented. ${name}, ${scope}, ${page}, ${perPage}, ${JSON.stringify(attributes)}, ${JSON.stringify(filters)}`,
    );
  }
  getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    throw new Error(`Method not implemented. ${agentName}, ${type}`);
  }
  getWorkflowRuns(args?: {
    namespace?: string;
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<WorkflowRuns> {
    throw new Error(`Method not implemented. ${JSON.stringify(args)}`);
  }
}
