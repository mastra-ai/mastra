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
import { IndexType, MetricType, MilvusClient } from '@zilliz/milvus2-sdk-node';
import type {
  CheckHealthResponse,
  DescribeCollectionResponse,
  DescribeIndexResponse,
  FieldType,
  GetVersionResponse,
  ResStatus,
  SearchResults,
} from '@zilliz/milvus2-sdk-node';
import type { IndexConfig } from './types';

export type CollectionOptions = {
  description?: string;
  timeout?: number;
  consistency_level?: 'Strong' | 'Session' | 'Bounded' | 'Eventually' | 'Customized';
  num_partitions?: number;
  enable_dynamic_field?: boolean;
};

export interface MilvusCreateIndexParams extends CreateIndexParams {
  collectionName?: string;
  fieldName?: string;
  indexConfig?: IndexConfig;
  metricType?: MetricType;
}

export interface MilvusIndexStats extends IndexStats {
  indexDescription: DescribeIndexResponse;
}

export interface MilvusUpsertVectorParams extends UpsertVectorParams {
  collectionName: string;
}

type MilvusCreateIndexArgs = [...CreateIndexArgs, IndexConfig?, boolean?];

export interface MilvusQueryVectorParams extends QueryVectorParams {
  collectionName: string;
}

export interface MilvusQueryVectorArgs extends QueryVectorArgs {
  collectionName: string;
}

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

  async listCollections(): Promise<string[]> {
    try {
      const response = await this.client.showCollections();
      return response.data.map(collection => collection.name);
    } catch (error) {
      throw new Error('Failed to list collections: ' + error);
    }
  }

  /**
   * Queries the vector store using the specified parameters or arguments.
   * Supports both object and tuple argument formats.
   * @param args - QueryVectorParams object or QueryVectorArgs tuple.
   * @returns Promise<QueryResult[]> - The query results.
   */
  async query(...args: ParamsToArgs<MilvusQueryVectorParams> | MilvusQueryVectorArgs): Promise<QueryResult[]> {
    const params = this.normalizeArgs<MilvusQueryVectorParams, MilvusQueryVectorArgs>('query', args, [
      'indexName',
      'queryVector',
      'topK',
      'filter',
      'collectionName',
      'includeVector',
    ]);
    const { queryVector, topK = 10, filter = '', collectionName, includeVector = false } = params;
    try {
      const searchParams: any = {
        collection_name: collectionName,
        data: [queryVector],
        topk: topK,
        filter,
        // output_fields: ['id', 'metadata', 'vector'],
      };

      // load collection
      const loadCollectionResponse = await this.client.loadCollection({
        collection_name: collectionName,
      });

      if (loadCollectionResponse.error_code !== 'Success') {
        throw new Error('Failed to load collection: ' + loadCollectionResponse.reason);
      }

      const res: SearchResults = await this.client.search(searchParams);
      console.log(res);

      if (!res.results) return [];

      return res.results.map((item: any) => ({
        id: item.id,
        score: item.score,
        metadata: item.metadata,
        vector: includeVector ? item.vector : undefined,
      })) as QueryResult[];
    } catch (error) {
      throw new Error('Failed to query vectors: ' + error);
    }
  }

  /**
   * Upserts (inserts or updates) vectors into the vector store.
   * Supports both object and tuple argument formats.
   * @param args - UpsertVectorParams object or UpsertVectorArgs tuple.
   * @returns Promise<string[]> - The inserted/updated IDs.
   */
  async upsert(...args: ParamsToArgs<MilvusUpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<MilvusUpsertVectorParams, UpsertVectorArgs>('upsert', args, [
      'indexName',
      'vectors',
      'metadata',
      'ids',
      'collectionName',
    ]);

    const { collectionName, vectors, ids = [], metadata = [] } = params;

    if (!collectionName) {
      throw new Error('Missing required parameter: collectionName');
    }

    if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
      throw new Error('vectors array is required and must not be empty');
    }

    // Generate IDs if not provided
    const entryIds = ids.length === vectors.length ? ids : vectors.map((_, i) => ids[i] || crypto.randomUUID());

    try {
      // Create one row entry for each vector, merging all extra fields
      const fields_data = vectors.map((vector, index) => {
        return {
          id: entryIds[index],
          vector: vector,
          metadata: metadata[index],
        };
      });

      const res = await this.client.insert({
        collection_name: collectionName,
        fields_data,
      });

      if (res.status.error_code !== 'Success') {
        throw new Error('Milvus DB error: ' + res.status.reason);
      }

      return entryIds;
    } catch (error) {
      throw new Error('Failed to upsert vectors: ' + error);
    }
  }

  /**
   * Creates an index on a field in a collection.
   * If index already exists, it will not throw an error. Also, only one index can be created per field.
   *
   * @param args - The arguments for creating the index.
   * @param args.collectionName - The name of the collection.
   * @param args.fieldName - The name of the field.
   * @param args.indexConfig - The configuration for the index.
   * @param args.metricType - The type of metric to use for the index.
   * @param args.indexName - The name of the index.
   * @param args.dimension - The dimension of the index.
   * @returns A Promise that resolves when the index is created.
   */
  async createIndex(...args: ParamsToArgs<MilvusCreateIndexParams> | MilvusCreateIndexArgs): Promise<void> {
    try {
      const params = this.normalizeArgs<MilvusCreateIndexParams, MilvusCreateIndexArgs>('createIndex', args, [
        'collectionName',
        'fieldName',
        'indexConfig',
        'metricType',
        'indexName',
        'dimension',
      ]);

      const { collectionName, fieldName, indexName, dimension, indexConfig = {}, metricType = MetricType.L2 } = params;

      if (!collectionName || !fieldName) {
        throw new Error('Missing required parameters: collectionName, fieldName');
      }

      await this.client.createIndex({
        collection_name: collectionName,
        field_name: fieldName,
        index_name: indexName,
        index_type: indexConfig.type ?? IndexType.IVF_FLAT,
        metric_type: metricType,
        params: {
          nlist: dimension,
        },
      });
    } catch (error) {
      throw new Error('Failed to create index: ' + error);
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      // Get all collection names
      const collections = await this.client.showCollections();
      const collectionNames = collections.data.map(collection => collection.name);

      // Get index names for each collection
      const indexNames: string[] = [];
      for (const collectionName of collectionNames) {
        const response: DescribeIndexResponse = await this.client.describeIndex({
          collection_name: collectionName,
        });
        indexNames.push(...response.index_descriptions.map(index => index.index_name));
      }
      return indexNames;
    } catch (error) {
      throw new Error('Failed to list indexes: ' + error);
    }
  }

  async describeIndex(collectionName: string): Promise<MilvusIndexStats> {
    try {
      const response: DescribeIndexResponse = await this.client.describeIndex({
        collection_name: collectionName,
      });

      return {
        indexDescription: response,
        dimension: 0,
        count: 0,
      };
    } catch (error) {
      throw new Error('Failed to describe index: ' + error);
    }
  }

  async dropIndex(collectionName: string, fieldName: string): Promise<void> {
    try {
      await this.client.dropIndex({
        collection_name: collectionName,
        field_name: fieldName,
      });
    } catch (error) {
      throw new Error('Failed to delete index: ' + error);
    }
  }

  deleteIndex(indexName: string): Promise<void> {
    throw new Error(`Method not implemented Use dropIndex instead for ${indexName}`);
  }
}
