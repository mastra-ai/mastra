import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DeleteVectorsParams,
} from '@mastra/core/vector';
import { Pinecone } from '@pinecone-database/pinecone';
import type {
  IndexStatsDescription,
  PineconeConfiguration,
  QueryOptions,
  RecordSparseValues,
  ServerlessSpecCloudEnum,
  UpdateOptions,
} from '@pinecone-database/pinecone';

import { PineconeFilterTranslator } from './filter';
import type { PineconeVectorFilter } from './filter';

/**
 * Configuration for PineconeVector.
 *
 * Extends the Pinecone client configuration with Mastra-specific fields.
 * All Pinecone configuration options are supported (apiKey, controllerHostUrl,
 * fetchApi, additionalHeaders, sourceTag).
 *
 * @example
 * ```typescript
 * // Simple API key config
 * const vector = new PineconeVector({
 *   id: 'my-pinecone',
 *   apiKey: 'your-api-key',
 * });
 *
 * // With custom controller host
 * const vector = new PineconeVector({
 *   id: 'my-pinecone',
 *   apiKey: 'your-api-key',
 *   controllerHostUrl: 'https://api.pinecone.io',
 * });
 *
 * // With index creation defaults
 * const vector = new PineconeVector({
 *   id: 'my-pinecone',
 *   apiKey: 'your-api-key',
 *   cloud: 'gcp',
 *   region: 'us-central1',
 * });
 * ```
 */
export type PineconeVectorConfig = PineconeConfiguration & {
  /** The unique identifier for this vector store instance. */
  id: string;
  /** The cloud provider for new index creation. Defaults to 'aws'. */
  cloud?: ServerlessSpecCloudEnum;
  /** The region for new index creation. Defaults to 'us-east-1'. */
  region?: string;
};

interface PineconeIndexStats extends IndexStats {
  namespaces?: IndexStatsDescription['namespaces'];
}

interface PineconeQueryVectorParams extends QueryVectorParams<PineconeVectorFilter> {
  namespace?: string;
  sparseVector?: RecordSparseValues;
}

interface PineconeUpsertVectorParams extends UpsertVectorParams {
  namespace?: string;
  sparseVectors?: RecordSparseValues[];
}

// Pinecone-specific update params that includes namespace in both union branches
type PineconeUpdateVectorParams =
  | {
      indexName: string;
      id: string;
      filter?: never;
      update: { vector?: number[]; metadata?: Record<string, any> };
      namespace?: string;
    }
  | {
      indexName: string;
      id?: never;
      filter: PineconeVectorFilter;
      update: { vector?: number[]; metadata?: Record<string, any> };
      namespace?: string;
    };

interface PineconeDeleteVectorParams extends DeleteVectorParams {
  namespace?: string;
}

interface PineconeDeleteVectorsParams extends DeleteVectorsParams<PineconeVectorFilter> {
  namespace?: string;
}

export class PineconeVector extends MastraVector<PineconeVectorFilter> {
  private client: Pinecone;
  private cloud: ServerlessSpecCloudEnum;
  private region: string;

  /**
   * Creates a new PineconeVector client.
   *
   * @param config - Configuration options for the Pinecone client.
   * @see {@link PineconeVectorConfig} for all available options.
   */
  constructor({ id, cloud, region, ...pineconeConfig }: PineconeVectorConfig) {
    super({ id });
    this.client = new Pinecone(pineconeConfig);
    this.cloud = cloud || 'aws';
    this.region = region || 'us-east-1';
  }

  get indexSeparator(): string {
    return '-';
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    try {
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }
      if (metric && !['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
        throw new Error('Metric must be one of: cosine, euclidean, dotproduct');
      }
    } catch (validationError) {
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'CREATE_INDEX', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, dimension, metric },
        },
        validationError,
      );
    }

    try {
      await this.client.createIndex({
        name: indexName,
        dimension: dimension,
        metric: metric,
        spec: {
          serverless: {
            cloud: this.cloud,
            region: this.region,
          },
        },
      });
    } catch (error: any) {
      // Check for 'already exists' error
      const message = error?.errors?.[0]?.message || error?.message;
      if (
        error.status === 409 ||
        (typeof message === 'string' &&
          (message.toLowerCase().includes('already exists') || message.toLowerCase().includes('duplicate')))
      ) {
        // Fetch index info and check dimensions
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }
      // For any other errors, wrap in MastraError
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }
  }

  async upsert({
    indexName,
    vectors,
    metadata,
    ids,
    namespace,
    sparseVectors,
  }: PineconeUpsertVectorParams): Promise<string[]> {
    const index = this.client.Index(indexName).namespace(namespace || '');

    // Generate IDs if not provided
    const vectorIds = ids || vectors.map(() => crypto.randomUUID());

    const records = vectors.map((vector, i) => ({
      id: vectorIds[i]!,
      values: vector,
      ...(sparseVectors?.[i] && { sparseValues: sparseVectors?.[i] }),
      metadata: metadata?.[i] || {},
    }));

    // Pinecone has a limit of 100 vectors per upsert request
    const batchSize = 100;
    try {
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await index.upsert(batch);
      }

      return vectorIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, vectorCount: vectors.length },
        },
        error,
      );
    }
  }

  transformFilter(filter?: PineconeVectorFilter) {
    const translator = new PineconeFilterTranslator();
    return translator.translate(filter);
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    namespace,
    sparseVector,
  }: PineconeQueryVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('PINECONE', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Pinecone queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    const index = this.client.Index(indexName).namespace(namespace || '');

    const translatedFilter = this.transformFilter(filter) ?? undefined;

    const queryParams: QueryOptions = {
      vector: queryVector,
      topK,
      includeMetadata: true,
      includeValues: includeVector,
      filter: translatedFilter,
    };

    // If sparse vector is provided, use hybrid search
    if (sparseVector) {
      queryParams.sparseVector = sparseVector;
    }

    try {
      const results = await index.query(queryParams);

      return results.matches.map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as Record<string, any>,
        ...(includeVector && { vector: match.values || [] }),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, topK },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const indexesResult = await this.client.listIndexes();
      return indexesResult?.indexes?.map(index => index.name) || [];
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'LIST_INDEXES', 'FAILED'),
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
  async describeIndex({ indexName }: DescribeIndexParams): Promise<PineconeIndexStats> {
    try {
      const index = this.client.Index(indexName);
      const stats = await index.describeIndexStats();
      const description = await this.client.describeIndex(indexName);

      return {
        dimension: description.dimension,
        count: stats.totalRecordCount || 0,
        metric: description.metric as 'cosine' | 'euclidean' | 'dotproduct',
        namespaces: stats.namespaces,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'DESCRIBE_INDEX', 'FAILED'),
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
      await this.client.deleteIndex(indexName);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'DELETE_INDEX', 'FAILED'),
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
   * Note: Pinecone only supports update by ID, not by filter.
   * @param params - Parameters containing the id for targeting the vector to update
   * @param params.indexName - The name of the index containing the vector.
   * @param params.id - The ID of the vector to update.
   * @param params.update - An object containing the vector and/or metadata to update.
   * @param namespace - The namespace of the index (optional, Pinecone-specific).
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector(params: PineconeUpdateVectorParams): Promise<void> {
    const { indexName, update } = params;

    // Validate mutually exclusive parameters
    if ('id' in params && params.id && 'filter' in params && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('PINECONE', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both id and filter - they are mutually exclusive',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!('id' in params && params.id) && !('filter' in params && params.filter)) {
      throw new MastraError({
        id: createVectorErrorId('PINECONE', 'UPDATE_VECTOR', 'NO_TARGET'),
        text: 'Either id or filter must be provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('PINECONE', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No updates provided',
        details: { indexName },
      });
    }

    // Extract Pinecone-specific namespace field
    const namespace = params.namespace;

    try {
      const index = this.client.Index(indexName).namespace(namespace || '');

      // Handle update by ID
      if ('id' in params && params.id) {
        const updateObj: UpdateOptions = { id: params.id };

        if (update.vector) {
          updateObj.values = update.vector;
        }

        if (update.metadata) {
          updateObj.metadata = update.metadata;
        }

        await index.update(updateObj);
      }
      // Handle update by filter (query first, then update each)
      else if ('filter' in params && params.filter) {
        // Validate filter is not empty
        if (Object.keys(params.filter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('PINECONE', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
            text: 'Filter cannot be an empty filter object',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
          });
        }

        const translatedFilter = this.transformFilter(params.filter);
        if (translatedFilter) {
          // Get index stats to know dimensions for dummy vector
          const stats = await this.describeIndex({ indexName });

          // Create a normalized dummy vector for querying (avoid zero vector for cosine similarity)
          const dummyVector = new Array(stats.dimension).fill(1 / Math.sqrt(stats.dimension));

          // Query with large topK to get all matching vectors
          // Pinecone's max topK is 10000
          const results = await index.query({
            vector: dummyVector,
            topK: 10000,
            filter: translatedFilter,
            includeMetadata: false,
            includeValues: false,
          });

          // Update each matching vector
          const idsToUpdate = results.matches.map(m => m.id as string);
          for (const id of idsToUpdate) {
            const updateObj: UpdateOptions = { id };

            if (update.vector) {
              updateObj.values = update.vector;
            }

            if (update.metadata) {
              updateObj.metadata = update.metadata;
            }

            await index.update(updateObj);
          }
        }
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...('id' in params && params.id && { id: params.id }),
            ...('filter' in params && params.filter && { filter: JSON.stringify(params.filter) }),
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
   * @param namespace - The namespace of the index (optional).
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName, id, namespace }: PineconeDeleteVectorParams): Promise<void> {
    try {
      const index = this.client.Index(indexName).namespace(namespace || '');
      await index.deleteOne(id);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
          },
        },
        error,
      );
    }
  }

  /**
   * Deletes multiple vectors by IDs or filter.
   * @param indexName - The name of the index containing the vectors.
   * @param ids - Array of vector IDs to delete (mutually exclusive with filter).
   * @param filter - Filter to match vectors to delete (mutually exclusive with ids).
   * @param namespace - The namespace of the index (optional, Pinecone-specific).
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if both ids and filter are provided, or if neither is provided.
   */
  async deleteVectors(params: PineconeDeleteVectorsParams): Promise<void> {
    const { indexName, filter, ids } = params;
    const namespace = params.namespace;

    // Validate mutually exclusive parameters
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('PINECONE', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both ids and filter - they are mutually exclusive',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('PINECONE', 'DELETE_VECTORS', 'NO_TARGET'),
        text: 'Either filter or ids must be provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate ids array is not empty
    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('PINECONE', 'DELETE_VECTORS', 'EMPTY_IDS'),
        text: 'Cannot delete with empty ids array',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate filter is not empty
    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('PINECONE', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        text: 'Cannot delete with empty filter object',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      const index = this.client.Index(indexName).namespace(namespace || '');

      if (ids) {
        // Delete by IDs - Pinecone's deleteMany accepts an array of IDs
        await index.deleteMany(ids);
      } else if (filter) {
        // Delete by filter - Pinecone's deleteMany doesn't properly support metadata filters
        // We need to query for matching IDs first, then delete them
        const translatedFilter = this.transformFilter(filter);
        if (translatedFilter) {
          // Get index stats to know dimensions for dummy vector
          const stats = await this.describeIndex({ indexName });

          // Create a normalized dummy vector for querying (avoid zero vector for cosine similarity)
          const dummyVector = new Array(stats.dimension).fill(1 / Math.sqrt(stats.dimension));

          // Query with large topK to get all matching vectors
          // Pinecone's max topK is 10000
          const results = await index.query({
            vector: dummyVector,
            topK: 10000,
            filter: translatedFilter,
            includeMetadata: false,
            includeValues: false,
          });

          // Extract IDs and delete them
          const idsToDelete = results.matches.map(m => m.id as string);
          if (idsToDelete.length > 0) {
            await index.deleteMany(idsToDelete);
          }
        }
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('PINECONE', 'DELETE_VECTORS', 'FAILED'),
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
