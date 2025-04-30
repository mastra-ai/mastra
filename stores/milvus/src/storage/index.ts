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
import type { CheckHealthResponse, ClientConfig, CollectionSchema, FieldType } from '@zilliz/milvus2-sdk-node';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

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

  translateSchema(schema: Record<string, StorageColumn>): FieldType[] {
    return Object.entries(schema).map(([name, column]) => {
      let dataType: DataType;
      let maxLength: number | undefined;

      switch (column.type) {
        case 'uuid':
          dataType = DataType.VarChar;
          maxLength = 36; // Standard UUID length
          break;
        case 'integer':
          dataType = DataType.Int32;
          break;
        case 'bigint':
          dataType = DataType.Int64;
          break;
        case 'text':
          dataType = DataType.VarChar;
          maxLength = 65535; // Default max length for text
          break;
        case 'timestamp':
          dataType = DataType.Int64;
          break;
        case 'jsonb':
          dataType = DataType.JSON;
          break;
        default:
          dataType = DataType.VarChar; // Default to VarChar if type is unknown
          maxLength = 255;
      }

      const fieldType: FieldType = {
        name,
        data_type: dataType,
        is_primary_key: column.primaryKey ?? false,
        nullable: column.nullable ?? true,
      };

      if (maxLength && dataType === DataType.VarChar) {
        fieldType.max_length = maxLength;
      }

      return fieldType;
    });
  }

  async getTableSchema(tableName: TABLE_NAMES): Promise<CollectionSchema> {
    try {
      const collection = await this.client.describeCollection({ collection_name: tableName });
      return collection.schema;
    } catch (error) {
      throw new Error('Failed to get collection: ' + error);
    }
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const fields = this.translateSchema(schema);
      console.log(fields);
      await this.client.createCollection({
        collection_name: tableName,
        schema: fields,
      });
    } catch (error) {
      throw new Error('Failed to create collection: ' + error);
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.client.dropCollection({ collection_name: tableName });
    } catch (error) {
      throw new Error('Failed to drop collection: ' + error);
    }
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
