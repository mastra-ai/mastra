import { randomUUID } from 'node:crypto';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector } from '@mastra/core/vector';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  DeleteVectorsParams,
  UpdateVectorParams,
} from '@mastra/core/vector';
import { Index } from '@upstash/vector';

import { UpstashFilterTranslator } from './filter';
import type { UpstashVectorFilter } from './filter';
import type { UpstashUpsertVectorParams, UpstashQueryVectorParams, UpstashUpdateVectorParams } from './types';

export class UpstashVector extends MastraVector<UpstashVectorFilter> {
  private client: Index;

  /**
   * Creates a new UpstashVector instance.
   * @param {object} params - The parameters for the UpstashVector.
   * @param {string} params.id - The unique identifier for this vector store instance.
   * @param {string} params.url - The URL of the Upstash vector index.
   * @param {string} params.token - The token for the Upstash vector index.
   */
  constructor({ url, token, id }: { url: string; token: string } & { id: string }) {
    super({ id });
    this.client = new Index({
      url,
      token,
    });
  }

  /**
   * Upserts vectors into the index.
   * @param {UpsertVectorParams} params - The parameters for the upsert operation.
   * @returns {Promise<string[]>} A promise that resolves to the IDs of the upserted vectors.
   */
  async upsert({
    indexName: namespace,
    vectors,
    metadata,
    ids,
    sparseVectors,
  }: UpstashUpsertVectorParams): Promise<string[]> {
    const generatedIds = ids || vectors.map(() => randomUUID());

    const points = vectors.map((vector, index) => ({
      id: generatedIds[index]!,
      vector,
      ...(sparseVectors?.[index] && { sparseVector: sparseVectors[index] }),
      metadata: metadata?.[index],
    }));

    try {
      await this.client.upsert(points, {
        namespace,
      });
      return generatedIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('UPSTASH', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { namespace, vectorCount: vectors.length },
        },
        error,
      );
    }
  }

  /**
   * Transforms a Mastra vector filter into an Upstash-compatible filter string.
   * @param {UpstashVectorFilter} [filter] - The filter to transform.
   * @returns {string | undefined} The transformed filter string, or undefined if no filter is provided.
   */
  transformFilter(filter?: UpstashVectorFilter) {
    const translator = new UpstashFilterTranslator();
    return translator.translate(filter);
  }

  /**
   * Creates a new index. For Upstash, this is a no-op as indexes (known as namespaces in Upstash) are created on-the-fly.
   * @param {CreateIndexParams} _params - The parameters for creating the index (ignored).
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  async createIndex(_params: CreateIndexParams): Promise<void> {
    this.logger.debug('No need to call createIndex for Upstash');
  }

  /**
   * Queries the vector index.
   * @param {QueryVectorParams} params - The parameters for the query operation. indexName is the namespace in Upstash.
   * @returns {Promise<QueryResult[]>} A promise that resolves to the query results.
   */
  async query({
    indexName: namespace,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    sparseVector,
    fusionAlgorithm,
    queryMode,
  }: UpstashQueryVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Upstash queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName: namespace },
      });
    }

    try {
      const ns = this.client.namespace(namespace);

      const filterString = this.transformFilter(filter);
      const results = await ns.query({
        topK,
        vector: queryVector,
        ...(sparseVector && { sparseVector }),
        includeVectors: includeVector,
        includeMetadata: true,
        ...(filterString ? { filter: filterString } : {}),
        ...(fusionAlgorithm && { fusionAlgorithm }),
        ...(queryMode && { queryMode }),
      });

      // Map the results to our expected format
      return (results || []).map(result => ({
        id: `${result.id}`,
        score: result.score,
        metadata: result.metadata,
        ...(includeVector && { vector: result.vector || [] }),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('UPSTASH', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { namespace, topK },
        },
        error,
      );
    }
  }

  /**
   * Lists all namespaces in the Upstash vector index, which correspond to indexes.
   * @returns {Promise<string[]>} A promise that resolves to a list of index names.
   */
  async listIndexes(): Promise<string[]> {
    try {
      const indexes = await this.client.listNamespaces();
      return indexes.filter(Boolean);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('UPSTASH', 'LIST_INDEXES', 'FAILED'),
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
   * @param {string} indexName - The name of the namespace to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName: namespace }: DescribeIndexParams): Promise<IndexStats> {
    try {
      const info = await this.client.info();

      return {
        dimension: info.dimension,
        count: info.namespaces?.[namespace]?.vectorCount || 0,
        metric: info?.similarityFunction?.toLowerCase() as 'cosine' | 'euclidean' | 'dotproduct',
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('UPSTASH', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { namespace },
        },
        error,
      );
    }
  }

  /**
   * Deletes an index (namespace).
   * @param {DeleteIndexParams} params - The parameters for the delete operation.
   * @returns {Promise<void>} A promise that resolves when the deletion is complete.
   */
  async deleteIndex({ indexName: namespace }: DeleteIndexParams): Promise<void> {
    try {
      await this.client.deleteNamespace(namespace);
    } catch (error: any) {
      // If the namespace doesn't exist, treat it as a no-op (already deleted)
      const errorMessage = error?.message || '';
      if (errorMessage.includes('does not exist') || errorMessage.includes('not found')) {
        this.logger.info(`Namespace ${namespace} does not exist, treating as already deleted`);
        return;
      }
      throw new MastraError(
        {
          id: createVectorErrorId('UPSTASH', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { namespace },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector by its ID or multiple vectors matching a filter.
   * @param params - Parameters containing the id or filter for targeting the vector(s) to update
   * @param params.indexName - The name of the namespace containing the vector.
   * @param params.id - The ID of the vector to update (mutually exclusive with filter).
   * @param params.filter - Filter to match multiple vectors to update (mutually exclusive with id).
   * @param params.update - An object containing the vector and/or metadata to update.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector(params: UpdateVectorParams<UpstashVectorFilter>): Promise<void> {
    const { indexName: namespace, update } = params;
    // Extract Upstash-specific sparseVector field from update
    const upstashUpdate = update as UpstashUpdateVectorParams['update'];
    const sparseVector = upstashUpdate.sparseVector;

    // Validate mutually exclusive parameters
    if ('id' in params && params.id && 'filter' in params && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both id and filter - they are mutually exclusive',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { namespace },
      });
    }

    if (!('id' in params && params.id) && !('filter' in params && params.filter)) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'UPDATE_VECTOR', 'NO_TARGET'),
        text: 'Either id or filter must be provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { namespace },
      });
    }

    if (!update.vector && !update.metadata && !sparseVector) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        text: 'No update data provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { namespace },
      });
    }

    // Validate filter is not empty
    if ('filter' in params && params.filter && Object.keys(params.filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
        text: 'Filter cannot be an empty filter object',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { namespace },
      });
    }

    // Note: Upstash requires both vector and metadata for upsert operations.
    // For partial updates (metadata-only or vector-only), we fetch the existing data
    // and merge it with the updates before calling upsert.

    try {
      const ns = this.client.namespace(namespace);

      // Handle update by ID
      if ('id' in params && params.id) {
        const points: any = { id: params.id };

        // For partial updates (metadata-only or vector-only), fetch existing data
        if (!update.vector || !update.metadata) {
          try {
            const existing = await ns.fetch([params.id], {
              includeVectors: true,
              includeMetadata: true,
            });

            if (existing && existing.length > 0 && existing[0]) {
              if (!update.vector && existing[0]?.vector) {
                points.vector = existing[0].vector;
              }
              if (!update.metadata && existing[0]?.metadata) {
                points.metadata = existing[0].metadata;
              }
            }
          } catch (fetchError) {
            // If fetch fails, we'll just proceed with what we have
            this.logger.warn(`Failed to fetch existing vector ${params.id} for partial update: ${fetchError}`);
          }
        }

        if (update.vector) points.vector = update.vector;
        if (update.metadata) points.metadata = update.metadata;
        if (sparseVector) points.sparseVector = sparseVector;

        await ns.upsert(points);
      }
      // Handle update by filter
      else if ('filter' in params && params.filter) {
        const filterString = this.transformFilter(params.filter);
        if (filterString) {
          // Get index stats to know dimensions for dummy vector
          const stats = await this.describeIndex({ indexName: namespace });

          // Create a normalized dummy vector for querying (avoid zero vector for cosine similarity)
          const dummyVector = new Array(stats.dimension).fill(1 / Math.sqrt(stats.dimension));

          // Query to get all matching vectors
          // For metadata-only updates, we need to fetch existing vectors
          const needsVectors = !update.vector;
          const results = await ns.query({
            vector: dummyVector,
            topK: 1000, // Upstash's max query limit
            filter: filterString,
            includeVectors: needsVectors,
            includeMetadata: needsVectors,
          });

          // Update each matching vector
          for (const result of results) {
            const points: any = { id: `${result.id}` };

            // For metadata-only updates, reuse existing vector
            if (update.vector) {
              points.vector = update.vector;
            } else if (result.vector) {
              points.vector = result.vector;
            }

            // For vector-only updates, reuse existing metadata
            if (update.metadata) {
              points.metadata = update.metadata;
            } else if (result.metadata) {
              points.metadata = result.metadata;
            }

            if (sparseVector) points.sparseVector = sparseVector;

            await ns.upsert(points);
          }
        }
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('UPSTASH', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
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
   * @param indexName - The name of the namespace containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName: namespace, id }: DeleteVectorParams): Promise<void> {
    try {
      const ns = this.client.namespace(namespace);
      await ns.delete(id);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('UPSTASH', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
            ...(id && { id }),
          },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
    }
  }

  /**
   * Deletes multiple vectors by IDs or filter.
   * @param indexName - The name of the namespace containing the vectors.
   * @param ids - Array of vector IDs to delete (mutually exclusive with filter).
   * @param filter - Filter to match vectors to delete (mutually exclusive with ids).
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if both ids and filter are provided, or if neither is provided.
   */
  async deleteVectors({ indexName: namespace, filter, ids }: DeleteVectorsParams<UpstashVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both ids and filter - they are mutually exclusive',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { namespace },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'DELETE_VECTORS', 'NO_TARGET'),
        text: 'Either filter or ids must be provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { namespace },
      });
    }

    // Validate ids array is not empty
    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'DELETE_VECTORS', 'EMPTY_IDS'),
        text: 'Cannot delete with empty ids array',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { namespace },
      });
    }

    // Validate filter is not empty
    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('UPSTASH', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        text: 'Cannot delete with empty filter object',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { namespace },
      });
    }

    try {
      const ns = this.client.namespace(namespace);

      if (ids) {
        // Delete by IDs - Upstash's delete accepts individual IDs or arrays
        await ns.delete(ids);
      } else if (filter) {
        // Delete by filter - Query first to get matching IDs, then delete
        const filterString = this.transformFilter(filter);
        if (filterString) {
          // Get index stats to know dimensions for dummy vector
          const stats = await this.describeIndex({ indexName: namespace });

          // Create a normalized dummy vector for querying (avoid zero vector for cosine similarity)
          const dummyVector = new Array(stats.dimension).fill(1 / Math.sqrt(stats.dimension));

          // Query to get all matching vectors
          const results = await ns.query({
            vector: dummyVector,
            topK: 1000, // Upstash's max query limit
            filter: filterString,
            includeVectors: false,
            includeMetadata: false,
          });

          // Delete all matching vectors
          const idsToDelete = results.map(r => `${r.id}`);
          if (idsToDelete.length > 0) {
            await ns.delete(idsToDelete);
          }
        }
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('UPSTASH', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
            ...(filter && { filter: JSON.stringify(filter) }),
            ...(ids && { idsCount: ids.length }),
          },
        },
        error,
      );
    }
  }
}
