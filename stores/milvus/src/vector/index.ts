import type {
  CreateIndexArgs,
  CreateIndexParams,
  IndexStats,
  ParamsToArgs,
  QueryResult,
  QueryVectorArgs,
  QueryVectorParams,
  UpsertVectorArgs,
  UpsertVectorParams,
} from '@mastra/core';
import { MastraVector } from '@mastra/core/vector';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import type {
  CheckHealthResponse,
  DescribeCollectionResponse,
  FieldType,
  GetVersionResponse,
  ResStatus,
} from '@zilliz/milvus2-sdk-node';

export type CollectionOptions = {
  description?: string;
  timeout?: number;
  consistency_level?: 'Strong' | 'Session' | 'Bounded' | 'Eventually' | 'Customized';
  num_partitions?: number;
  enable_dynamic_field?: boolean;
};

export class MilvusVectorStore extends MastraVector {
  private client: MilvusClient;
  constructor({
    address,
    username,
    password,
    ssl,
  }: {
    address: string;
    username?: string;
    password?: string;
    ssl?: boolean;
  }) {
    super();
    this.client = new MilvusClient({ address, ssl, username, password });
  }

  async checkHealth(): Promise<CheckHealthResponse> {
    return this.client.checkHealth();
  }

  async checkVersion(): Promise<GetVersionResponse> {
    return this.client.getVersion();
  }

  async createCollection(name: string, schema: FieldType[], options?: CollectionOptions): Promise<ResStatus> {
    try {
      return this.client.createCollection({
        collection_name: name,
        description: options?.description ?? '',
        fields: schema,
        timeout: options?.timeout,
        consistency_level: options?.consistency_level,
        num_partitions: options?.num_partitions,
        enable_dynamic_field: options?.enable_dynamic_field,
      });
    } catch (error) {
      throw new Error('Failed to create collection: ' + error);
    }
  }

  async dropCollection(collectionName: string): Promise<ResStatus> {
    try {
      return this.client.dropCollection({
        collection_name: collectionName,
      });
    } catch (error) {
      throw new Error('Failed to drop collection: ' + error);
    }
  }

  async describeCollection(collectionName: string): Promise<DescribeCollectionResponse> {
    try {
      return this.client.describeCollection({
        collection_name: collectionName,
      });
    } catch (error) {
      throw new Error('Failed to describe collection: ' + error);
    }
  }

  query<E extends QueryVectorArgs = QueryVectorArgs>(
    ...args: ParamsToArgs<QueryVectorParams> | E
  ): Promise<QueryResult[]> {
    throw new Error('Method not implemented.' + args);
  }
  upsert<E extends UpsertVectorArgs = UpsertVectorArgs>(
    ...args: ParamsToArgs<UpsertVectorParams> | E
  ): Promise<string[]> {
    throw new Error('Method not implemented.' + args);
  }
  createIndex<E extends CreateIndexArgs = CreateIndexArgs>(
    ...args: ParamsToArgs<CreateIndexParams> | E
  ): Promise<void> {
    throw new Error('Method not implemented.' + args);
  }
  listIndexes(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  describeIndex(indexName: string): Promise<IndexStats> {
    throw new Error('Method not implemented.' + indexName);
  }
  deleteIndex(indexName: string): Promise<void> {
    throw new Error('Method not implemented.' + indexName);
  }
}
