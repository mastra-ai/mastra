import { MastraVector } from '@mastra/core/vector';
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
import type { VectorFilter } from '@mastra/core/vector/filter';
import { Index } from '@upstash/vector';

import { UpstashFilterTranslator } from './filter';

export class UpstashVector extends MastraVector {
  private client: Index;

  /**
   * Creates a new UpstashVector instance.
   * @param {object} params - The parameters for the UpstashVector.
   * @param {string} params.url - The URL of the Upstash vector index.
   * @param {string} params.token - The token for the Upstash vector index.
   */
  constructor({ url, token }: { url: string; token: string }) {
    super();
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
  async upsert({ indexName: namespace, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    const generatedIds = ids || vectors.map(() => crypto.randomUUID());

    const points = vectors.map((vector, index) => ({
      id: generatedIds[index]!,
      vector,
      metadata: metadata?.[index],
    }));

    await this.client.upsert(points, {
      namespace,
    });
    return generatedIds;
  }

  /**
   * Transforms a Mastra vector filter into an Upstash-compatible filter string.
   * @param {VectorFilter} [filter] - The filter to transform.
   * @returns {string | undefined} The transformed filter string, or undefined if no filter is provided.
   */
  transformFilter(filter?: VectorFilter) {
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
  }: QueryVectorParams): Promise<QueryResult[]> {
    const ns = this.client.namespace(namespace);

    const filterString = this.transformFilter(filter);
    const results = await ns.query({
      topK,
      vector: queryVector,
      includeVectors: includeVector,
      includeMetadata: true,
      ...(filterString ? { filter: filterString } : {}),
    });

    // Map the results to our expected format
    return (results || []).map(result => ({
      id: `${result.id}`,
      score: result.score,
      metadata: result.metadata,
      ...(includeVector && { vector: result.vector || [] }),
    }));
  }

  /**
   * Lists all namespaces in the Upstash vector index, which correspond to indexes.
   * @returns {Promise<string[]>} A promise that resolves to a list of index names.
   */
  async listIndexes(): Promise<string[]> {
    const indexes = await this.client.listNamespaces();
    return indexes.filter(Boolean);
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the namespace to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName: namespace }: DescribeIndexParams): Promise<IndexStats> {
    const info = await this.client.info();

    return {
      dimension: info.dimension,
      count: info.namespaces?.[namespace]?.vectorCount || 0,
      metric: info?.similarityFunction?.toLowerCase() as 'cosine' | 'euclidean' | 'dotproduct',
    };
  }

  /**
   * Deletes an index (namespace).
   * @param {DeleteIndexParams} params - The parameters for the delete operation.
   * @returns {Promise<void>} A promise that resolves when the deletion is complete.
   */
  async deleteIndex({ indexName: namespace }: DeleteIndexParams): Promise<void> {
    try {
      await this.client.deleteNamespace(namespace);
    } catch (error) {
      this.logger.error('Failed to delete namespace:', error);
    }
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the namespace containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName: namespace, id, update }: UpdateVectorParams): Promise<void> {
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No update data provided');
      }

      // The upstash client throws an exception as: 'This index requires dense vectors' when
      // only metadata is present in the update object.
      if (!update.vector && update.metadata) {
        throw new Error('Both vector and metadata must be provided for an update');
      }

      const updatePayload: any = { id: id };
      if (update.vector) {
        updatePayload.vector = update.vector;
      }
      if (update.metadata) {
        updatePayload.metadata = update.metadata;
      }

      const points = {
        id: updatePayload.id,
        vector: updatePayload.vector,
        metadata: updatePayload.metadata,
      };

      await this.client.upsert(points, {
        namespace,
      });
    } catch (error: any) {
      throw new Error(`Failed to update vector by id: ${id} for index name: ${namespace}: ${error.message}`);
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
      await this.client.delete(id, {
        namespace,
      });
    } catch (error) {
      this.logger.error(`Failed to delete vector by id: ${id} for namespace: ${namespace}:`, error);
    }
  }
}
