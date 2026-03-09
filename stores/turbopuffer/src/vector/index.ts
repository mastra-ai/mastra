import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
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
  DeleteVectorsParams,
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

  constructor(opts: TurbopufferVectorOptions & { id: string }) {
    super({ id: opts.id });
    this.filterTranslator = new TurbopufferFilterTranslator();
    this.opts = opts;
    this.client = new Turbopuffer(opts);
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
          id: createVectorErrorId('TURBOPUFFER', 'CREATE_INDEX', 'INVALID_ARGS'),
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
          id: createVectorErrorId('TURBOPUFFER', 'UPSERT', 'INVALID_ARGS'),
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
          id: createVectorErrorId('TURBOPUFFER', 'UPSERT', 'FAILED'),
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
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('TURBOPUFFER', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Turbopuffer queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

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
          id: createVectorErrorId('TURBOPUFFER', 'QUERY', 'INVALID_ARGS'),
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
          id: createVectorErrorId('TURBOPUFFER', 'QUERY', 'FAILED'),
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
          id: createVectorErrorId('TURBOPUFFER', 'LIST_INDEXES', 'FAILED'),
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
          id: createVectorErrorId('TURBOPUFFER', 'DESCRIBE_INDEX', 'FAILED'),
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
          id: createVectorErrorId('TURBOPUFFER', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector by its ID or filter with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param filter - The filter to match vectors to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName, id, filter, update }: UpdateVectorParams<TurbopufferVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (id && filter) {
      throw new MastraError({
        id: createVectorErrorId('TURBOPUFFER', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'id and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!id && !filter) {
      throw new MastraError({
        id: createVectorErrorId('TURBOPUFFER', 'UPDATE_VECTOR', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either id or filter must be provided',
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('TURBOPUFFER', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No update data provided',
        details: { indexName, ...(id && { id }) },
      });
    }

    let namespace;
    let createIndex;
    let distanceMetric;
    try {
      namespace = this.client.namespace(indexName);
      createIndex = this.createIndexCache.get(indexName);
      if (!createIndex) {
        throw new Error(`createIndex() not called for this index`);
      }
      distanceMetric = createIndex.tpufDistanceMetric;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('TURBOPUFFER', 'UPDATE_VECTOR', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        },
        error,
      );
    }

    try {
      let idsToUpdate: string[] = [];

      if (id) {
        idsToUpdate = [id];
      } else if (filter) {
        // Validate filter is not empty
        if (Object.keys(filter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('TURBOPUFFER', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: 'Filter cannot be an empty object',
            details: { indexName },
          });
        }

        // Query for matching vectors to get their IDs
        const dummyVector = new Array(createIndex.dimension).fill(1 / Math.sqrt(createIndex.dimension));
        const translatedFilter = this.filterTranslator.translate(filter);

        const results = await namespace.query({
          vector: dummyVector,
          top_k: 10000, // Get all matching vectors
          filters: translatedFilter,
          include_vectors: update.vector ? true : false, // Only fetch vectors if we're not replacing them
          include_attributes: ['*'],
        });

        idsToUpdate = results.map(r => String(r.id));

        // If we're doing a partial update (only metadata or only vector), we need existing data
        if (!update.vector || !update.metadata) {
          for (const result of results) {
            const record: Vector = { id: result.id };
            if (update.vector) {
              record.vector = update.vector;
            } else if (result.vector) {
              record.vector = result.vector;
            }
            if (update.metadata) {
              record.attributes = update.metadata;
            } else if (result.attributes) {
              record.attributes = result.attributes;
            }
            await namespace.upsert({
              vectors: [record],
              distance_metric: distanceMetric,
            });
          }
          return;
        }
      }

      // If no vectors to update, return early
      if (idsToUpdate.length === 0) {
        this.logger.info(`No vectors matched the criteria for update in ${indexName}`);
        return;
      }

      // Full update - we have both vector and metadata (or just one without needing existing data)
      const records: Vector[] = idsToUpdate.map(vecId => {
        const record: Vector = { id: vecId };
        if (update.vector) record.vector = update.vector;
        if (update.metadata) record.attributes = update.metadata;
        return record;
      });

      // Batch updates in chunks of 1000
      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await namespace.upsert({
          vectors: batch,
          distance_metric: distanceMetric,
        });
      }
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('TURBOPUFFER', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
            ...(filter && { filter: JSON.stringify(filter) }),
          },
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
          id: createVectorErrorId('TURBOPUFFER', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<TurbopufferVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('TURBOPUFFER', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'ids and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('TURBOPUFFER', 'DELETE_VECTORS', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either filter or ids must be provided',
        details: { indexName },
      });
    }

    // Validate non-empty arrays and objects
    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('TURBOPUFFER', 'DELETE_VECTORS', 'EMPTY_IDS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'ids array cannot be empty',
        details: { indexName },
      });
    }

    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('TURBOPUFFER', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Filter cannot be an empty object',
        details: { indexName },
      });
    }

    try {
      const namespace = this.client.namespace(indexName);
      let idsToDelete: string[] = [];

      if (ids) {
        idsToDelete = ids;
      } else if (filter) {
        // Query for matching vectors to get their IDs
        const createIndex = this.createIndexCache.get(indexName);
        if (!createIndex) {
          throw new Error(`createIndex() not called for this index`);
        }

        const dummyVector = new Array(createIndex.dimension).fill(1 / Math.sqrt(createIndex.dimension));
        const translatedFilter = this.filterTranslator.translate(filter);

        const results = await namespace.query({
          vector: dummyVector,
          top_k: 10000, // Get all matching vectors
          filters: translatedFilter,
          include_vectors: false,
          include_attributes: [],
        });

        idsToDelete = results.map(r => String(r.id));
      }

      // If no IDs to delete, return early
      if (idsToDelete.length === 0) {
        this.logger.info(`No vectors matched the criteria for deletion in ${indexName}`);
        return;
      }

      // The turbopuffer SDK has a limit of 1000 IDs per delete request.
      const batchSize = 1000;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        await namespace.delete({ ids: batch });
      }
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('TURBOPUFFER', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(filter && { filter: JSON.stringify(filter) }),
            ...(ids && { idsCount: ids.length }),
          },
        },
        error,
      );
    }
  }
}
