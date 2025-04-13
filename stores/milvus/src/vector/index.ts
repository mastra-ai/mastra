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
import type { CheckHealthResponse, GetVersionResponse, ResStatus } from '@zilliz/milvus2-sdk-node';

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

  async createCollection(collectionName: string, schema: any): Promise<ResStatus> {
    return this.client.createCollection({
      collection_name: collectionName,
      description: `my first collection`,
      fields: schema,
    });
  }

  async dropCollection(collectionName: string): Promise<ResStatus> {
    return this.client.dropCollection({
      collection_name: collectionName,
    });
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
