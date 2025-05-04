import type { MessageType, StorageThreadType, WorkflowRuns } from '@mastra/core';
import { MastraStorage } from '@mastra/core/storage';
import type { StorageColumn, EvalRow, StorageGetMessagesArg, TABLE_NAMES } from '@mastra/core/storage';
import type { CheckHealthResponse, ClientConfig, CollectionSchema, FieldType } from '@zilliz/milvus2-sdk-node';
import { MilvusClient, DataType, IndexType, MetricType } from '@zilliz/milvus2-sdk-node';

export class MilvusStorage extends MastraStorage {
  private client: MilvusClient;
  private loadedCollections: Set<string>;

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
      this.loadedCollections = new Set<string>();
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

  transformCollectionDescription(schema: CollectionSchema): Record<string, StorageColumn>[] {
    const types: Record<string, string> = {
      int64: 'bigint',
      uuid: 'uuid',
      int32: 'integer',
      varchar: 'text',
      float64: 'float',
      floatvector: 'vector',
      json: 'jsonb',
    };

    return schema.fields.map(field => ({
      [field.name]: {
        type: types[field.data_type.toString().toLowerCase()] as StorageColumn['type'],
        nullable: field.nullable,
        primaryKey: field.is_primary_key,
      },
    }));
  }

  async getTableSchema(tableName: TABLE_NAMES): Promise<Record<string, StorageColumn>[]> {
    try {
      const collection = await this.client.describeCollection({ collection_name: tableName });
      return this.transformCollectionDescription(collection.schema);
    } catch (error) {
      throw new Error('Failed to get collection: ' + error);
    }
  }

  /**
   * Creates a table in Milvus with the given schema. An extra placeholder vector field is added to the schema. Milvus requires at least one vector field to be present in the collection schema.
   *
   * check this discussion thread for reference: https://github.com/milvus-io/milvus/discussions/34927
   *
   * @param tableName - The table name.
   * @param schema - The schema of the table.
   */
  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const fields = this.translateSchema(schema);

      // Add a placeholder vector field - required by Milvus
      fields.push({
        name: 'vector_placeholder',
        data_type: DataType.FloatVector,
        dim: 2, // Smallest possible dimension
        is_primary_key: false,
      });

      const response = await this.client.createCollection({
        collection_name: tableName,
        schema: fields,
      });

      if (response.error_code !== 'Success') {
        throw new Error('Error status code: ' + response.reason);
      }

      // Creating index on placeholder vector field because milvus requires mandatory index on vector field
      await this.client.createIndex({
        collection_name: tableName,
        field_name: 'vector_placeholder',
        index_name: 'vector_idx',
        index_type: IndexType.IVF_FLAT,
        metric_type: MetricType.L2,
      });
    } catch (error) {
      throw new Error('Failed to create collection: ' + error);
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.client.dropCollection({ collection_name: tableName });
      // Remove from loaded collections after dropping
      this.loadedCollections.delete(tableName);
    } catch (error) {
      throw new Error('Failed to clear collection: ' + error);
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      // Add placeholder vector field - required by Milvus
      record.vector_placeholder = [0, 0];
      const response = await this.client.upsert({
        collection_name: tableName,
        data: [record],
      });

      if (response.status.error_code !== 'Success') {
        throw new Error('Error status code: ' + response.status.reason);
      }
    } catch (error) {
      throw new Error('Failed to insert record: ' + error);
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    try {
      // Add placeholder vector field - required by Milvus
      records.forEach(record => {
        record.vector_placeholder = [0, 0];
      });
      const response = await this.client.upsert({
        collection_name: tableName,
        data: records,
      });

      if (response.status.error_code !== 'Success') {
        throw new Error('Error status code: ' + response.status.reason);
      }
    } catch (error) {
      throw new Error('Failed to insert record: ' + error);
    }
  }

  /**
   * Ensures a collection is loaded into memory before querying
   * @param tableName - The name of the collection to load
   */
  private async ensureCollectionLoaded(tableName: TABLE_NAMES): Promise<void> {
    if (!this.loadedCollections.has(tableName)) {
      const loadResponse = await this.client.loadCollection({ collection_name: tableName });

      if (loadResponse.error_code !== 'Success') {
        throw new Error('Error loading collection: ' + loadResponse.reason);
      }

      this.loadedCollections.add(tableName);
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    try {
      // Only load collection if not already loaded
      await this.ensureCollectionLoaded(tableName);

      const filter = Object.entries(keys)
        .map(([key, value]) => {
          if (typeof value === 'string') {
            return `${key} == "${value}"`;
          } else if (typeof value === 'number') {
            return `${key} == ${value}`;
          } else if (typeof value === 'boolean') {
            return `${key} == ${value}`;
          } else {
            return `${key} == "${value}"`;
          }
        })
        .join(' AND ');

      const response = await this.client.query({
        collection_name: tableName,
        filter,
      });

      if (response.status.error_code !== 'Success') {
        throw new Error('Error status code: ' + response.status.reason);
      }

      return response.data as R;
    } catch (error) {
      throw new Error('Failed to load record: ' + error);
    }
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
