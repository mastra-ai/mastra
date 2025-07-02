import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from '@mastra/core/vector';
import { MastraVector } from '@mastra/core/vector';
import { Turbopuffer } from '@turbopuffer/turbopuffer';
import type { DistanceMetric, QueryResults, Schema, Vector } from '@turbopuffer/turbopuffer';
import { TurbopufferFilterTranslator } from './filter';
import type { TurbopufferVectorFilter } from './filter';

type TurbopufferQueryVectorParams = QueryVectorParams<TurbopufferVectorFilter>;

export interface TurbopufferVectorOptions {
  /** The API key to authenticate with. */
  apiKey: string;
  /** The base URL. Default is https://api.turbopuffer.com. */
  baseUrl?: string;
  /** The timeout to establish a connection, in ms. Default is 10_000. Only applicable in Node and Deno.*/
  connectTimeout?: number;
  /** The socket idle timeout, in ms. Default is 60_000. Only applicable in Node and Deno.*/
  connectionIdleTimeout?: number;
  /** The number of connections to open initially when creating a new client. Default is 0. */
  warmConnections?: number;
  /** Whether to compress requests and accept compressed responses. Default is true. */
  compression?: boolean;
  /**
   * A callback function that takes an index name and returns a config object for that index.
   * This allows you to define explicit schemas per index.
   *
   * Example:
   * ```typescript
   * schemaConfigForIndex: (indexName: string) => {
   *   // Mastra's default embedding model and index for memory messages:
   *   if (indexName === "memory_messages_384") {
   *     return {
   *       dimensions: 384,
   *       schema: {
   *         thread_id: {
   *           type: "string",
   *           filterable: true,
   *         },
   *       },
   *     };
   *   } else {
   *     throw new Error(`TODO: add schema for index: ${indexName}`);
   *   }
   * },
   * ```
   */
  schemaConfigForIndex?: (indexName: string) => {
    dimensions: number;
    schema: Schema;
  };
}

export class TurbopufferVector extends MastraVector<TurbopufferVectorFilter> {
  private client: Turbopuffer;
  private filterTranslator: TurbopufferFilterTranslator;
  // There is no explicit create index operation in Turbopuffer, so just register that
  // someone has called createIndex() and verify that subsequent upsert calls are consistent
  // with how the index was "created"
  private createIndexCache: Map<
    string,
    CreateIndexParams & {
      tpufDistanceMetric: DistanceMetric;
    }
  > = new Map();
  private opts: TurbopufferVectorOptions;

  constructor(opts: TurbopufferVectorOptions) {
    super();
    this.filterTranslator = new TurbopufferFilterTranslator();
    this.opts = opts;

    const baseClient = new Turbopuffer(opts);
    const telemetry = this.__getTelemetry();
    this.client =
      telemetry?.traceClass(baseClient, {
        spanNamePrefix: 'turbopuffer-vector',
        attributes: {
          'vector.type': 'turbopuffer',
        },
      }) ?? baseClient;
  }

  async createIndex({ indexName, dimension, metric }: CreateIndexParams): Promise<void> {
    metric = metric ?? 'cosine'; // default to cosine distance
    let distanceMetric: DistanceMetric = 'cosine_distance';
    try {
      if (this.createIndexCache.has(indexName)) {
        // verify that the dimensions and distance metric match what we expect
        const expected = this.createIndexCache.get(indexName)!;
        if (dimension !== expected.dimension || metric !== expected.metric) {
          throw new Error(
            `createIndex() called more than once with inconsistent inputs. Index ${indexName} expected dimensions=${expected.dimension} and metric=${expected.metric} but got dimensions=${dimension} and metric=${metric}`,
          );
        }
        return;
      }
      if (dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }
      switch (metric) {
        case 'cosine':
          distanceMetric = 'cosine_distance';
          break;
        case 'euclidean':
          distanceMetric = 'euclidean_squared';
          break;
        case 'dotproduct':
          throw new Error('dotproduct is not supported in Turbopuffer');
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_CREATE_INDEX_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }

    this.createIndexCache.set(indexName, {
      indexName,
      dimension,
      metric,
      tpufDistanceMetric: distanceMetric,
    });
  }

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    let index;
    let createIndex;
    try {
      if (vectors.length === 0) {
        throw new Error('upsert() called with empty vectors');
      }

      index = this.client.namespace(indexName);
      createIndex = this.createIndexCache.get(indexName);
      if (!createIndex) {
        throw new Error(`createIndex() not called for this index`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_UPSERT_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        },
        error,
      );
    }

    try {
      const distanceMetric = createIndex.tpufDistanceMetric;
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());
      const records: Vector[] = vectors.map((vector, i) => ({
        id: vectorIds[i]!,
        vector: vector,
        attributes: metadata?.[i] || {},
      }));

      // limit is 256 MB per upsert request, so set a reasonable batch size here that will stay under that for most cases
      // https://turbopuffer.com/docs/limits
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const upsertOptions: {
          vectors: Vector[];
          distance_metric: DistanceMetric;
          schema?: Schema;
          batchSize?: number;
        } = {
          vectors: batch,
          distance_metric: distanceMetric,
        };

        // Use the schemaForIndex callback if provided
        const schemaConfig = this.opts.schemaConfigForIndex?.(indexName);
        if (schemaConfig) {
          upsertOptions.schema = schemaConfig.schema;
          if (vectors[0]?.length !== schemaConfig.dimensions) {
            throw new Error(
              `Turbopuffer index ${indexName} was configured with dimensions=${schemaConfig.dimensions} but attempting to upsert vectors[0].length=${vectors[0]?.length}`,
            );
          }
        }

        await index.upsert(upsertOptions);
      }

      return vectorIds;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_UPSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async query({
    indexName,
    queryVector,
    topK,
    filter,
    includeVector,
  }: TurbopufferQueryVectorParams): Promise<QueryResult[]> {
    let createIndex;
    try {
      const schemaConfig = this.opts.schemaConfigForIndex?.(indexName);
      if (schemaConfig) {
        if (queryVector.length !== schemaConfig.dimensions) {
          throw new Error(
            `Turbopuffer index ${indexName} was configured with dimensions=${schemaConfig.dimensions} but attempting to query with queryVector.length=${queryVector.length}`,
          );
        }
      }
      createIndex = this.createIndexCache.get(indexName);
      if (!createIndex) {
        throw new Error(`createIndex() not called for this index`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_QUERY_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        },
        error,
      );
    }

    const distanceMetric = createIndex.tpufDistanceMetric;
    try {
      const index = this.client.namespace(indexName);
      const translatedFilter = this.filterTranslator.translate(filter);
      const results: QueryResults = await index.query({
        distance_metric: distanceMetric,
        vector: queryVector,
        top_k: topK,
        filters: translatedFilter,
        include_vectors: includeVector,
        include_attributes: true,
        consistency: { level: 'strong' }, // todo: make this configurable somehow?
      });
      return results.map(item => ({
        id: String(item.id),
        score: typeof item.dist === 'number' ? item.dist : 0,
        metadata: item.attributes || {},
        ...(includeVector && item.vector ? { vector: item.vector } : {}),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_QUERY_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const namespacesResult = await this.client.namespaces({});
      return namespacesResult.namespaces.map(namespace => namespace.id);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_LIST_INDEXES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      const namespace = this.client.namespace(indexName);
      const metadata = await namespace.metadata();
      const createIndex = this.createIndexCache.get(indexName);
      if (!createIndex) {
        throw new Error(`createIndex() not called for this index`);
      }
      const dimension = metadata.dimensions;
      const count = metadata.approx_count;
      return {
        dimension,
        count,
        metric: createIndex.metric,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_DESCRIBE_INDEX_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      const namespace = this.client.namespace(indexName);
      await namespace.deleteAll();
      this.createIndexCache.delete(indexName);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_DELETE_INDEX_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
    let namespace;
    let createIndex;
    let distanceMetric;
    let record;
    try {
      namespace = this.client.namespace(indexName);
      createIndex = this.createIndexCache.get(indexName);
      if (!createIndex) {
        throw new Error(`createIndex() not called for this index`);
      }
      distanceMetric = createIndex.tpufDistanceMetric;
      record = { id } as Vector;
      if (update.vector) record.vector = update.vector;
      if (update.metadata) record.attributes = update.metadata;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_UPDATE_VECTOR_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        },
        error,
      );
    }
    try {
      await namespace.upsert({
        vectors: [record],
        distance_metric: distanceMetric,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_UPDATE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    try {
      const namespace = this.client.namespace(indexName);
      await namespace.delete({ ids: [id] });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'STORAGE_TURBOBUFFER_VECTOR_DELETE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }
}
