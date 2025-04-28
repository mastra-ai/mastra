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
import { MilvusFilterTranslator } from './filter';
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
  jsonPath?: string;
  jsonCastType?: string;
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
    trace,
    logLevel,
  }: {
    address: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    trace?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  }) {
    super();
    this.client = new MilvusClient({ address, ssl, username, password, trace, logLevel });
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
    const { queryVector, topK = 10, filter = {}, collectionName, includeVector = false } = params;
    try {
      const milvusFilter = new MilvusFilterTranslator().translate(filter);
      const searchParams = {
        collection_name: collectionName,
        data: [queryVector],
        topk: topK,
        filter: milvusFilter,
        output_fields: ['id', 'metadata', 'vector'],
      };

      // load collection
      const loadCollectionResponse = await this.client.loadCollection({
        collection_name: collectionName,
      });

      if (loadCollectionResponse.error_code !== 'Success') {
        throw new Error('Failed to load collection: ' + loadCollectionResponse.reason);
      }

      const res: SearchResults = await this.client.search(searchParams);

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
        'jsonPath',
        'jsonCastType',
      ]);

      const {
        collectionName,
        fieldName,
        indexName,
        dimension,
        indexConfig = {},
        metricType = MetricType.L2,
        jsonPath,
        jsonCastType,
      } = params;

      if (!collectionName || !fieldName) {
        throw new Error('Missing required parameters: collectionName, fieldName');
      }

      // Build index parameters based on index type
      const indexType = indexConfig.type ?? IndexType.IVF_FLAT;
      const indexParams: Record<string, any> = {};

      // Configure index parameters based on index type
      if (indexType.startsWith('IVF')) {
        // Handle IVF-based indexes (IVF_FLAT, IVF_SQ8, IVF_PQ, etc.)
        const nlist = indexConfig.ivf?.lists || dimension;
        indexParams.nlist = nlist;

        // Add PQ-specific parameters if needed
        if (indexType === IndexType.IVF_PQ) {
          // Set m (number of subquantizers) to 4 by default or something appropriate
          indexParams.m = 4;
          // nbits is typically 8
          indexParams.nbits = 8;
        }
      } else if (indexType === IndexType.HNSW) {
        // Handle HNSW specific parameters
        indexParams.M = indexConfig.hnsw?.m || 16; // Default edges per node
        indexParams.efConstruction = indexConfig.hnsw?.efConstruction || 200; // Default size of candidate list
      } else if (indexType === IndexType.DISKANN) {
        // DiskANN specific parameters if needed
        indexParams.search_list = 100;
      } else if (indexType.startsWith('BIN_')) {
        // Handle binary vector indexes (BIN_FLAT, BIN_IVF_FLAT)
        if (indexType === IndexType.BIN_IVF_FLAT) {
          indexParams.nlist = indexConfig.ivf?.lists || 128;
        }
      } else if (indexType === IndexType.INVERTED) {
        // Handle inverted index
        indexParams.json_path = jsonPath;
        indexParams.json_cast_type = jsonCastType;
      } else {
        // FLAT and other index types
        // FLAT doesn't need specific parameters, but we'll set one to conform to API
        indexParams.nlist = dimension;
      }

      await this.client.createIndex({
        collection_name: collectionName,
        field_name: fieldName,
        index_name: indexName,
        index_type: indexType,
        metric_type: metricType,
        params: indexParams,
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
    throw new Error(`Method not implemented. Use dropIndex instead for ${indexName}`);
  }
}
