import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
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

  constructor({ url, token }: { url: string; token: string }) {
    super();
    this.client = new Index({
      url,
      token,
    });
  }

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    const generatedIds = ids || vectors.map(() => crypto.randomUUID());

    const points = vectors.map((vector, index) => ({
      id: generatedIds[index]!,
      vector,
      metadata: metadata?.[index],
    }));

    try {
      await this.client.upsert(points, {
        namespace: indexName,
      });
      return generatedIds;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_VECTOR_UPSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, vectorCount: vectors.length },
        },
        error,
      );
    }
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new UpstashFilterTranslator();
    return translator.translate(filter);
  }

  async createIndex(_params: CreateIndexParams): Promise<void> {
    console.log('No need to call createIndex for Upstash');
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: QueryVectorParams): Promise<QueryResult[]> {
    try {
      const ns = this.client.namespace(indexName);

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
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_VECTOR_QUERY_FAILED',
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
      const indexes = await this.client.listNamespaces();
      return indexes.filter(Boolean);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_VECTOR_LIST_INDEXES_FAILED',
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
      const info = await this.client.info();

      return {
        dimension: info.dimension,
        count: info.namespaces?.[indexName]?.vectorCount || 0,
        metric: info?.similarityFunction?.toLowerCase() as 'cosine' | 'euclidean' | 'dotproduct',
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_VECTOR_DESCRIBE_INDEX_FAILED',
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
      await this.client.deleteNamespace(indexName);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_VECTOR_DELETE_INDEX_FAILED',
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
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No update data provided');
      }

      // The upstash client throws an exception as: 'This index requires dense vectors' when
      // only metadata is present in the update object.
      if (!update.vector && update.metadata) {
        throw new Error('Both vector and metadata must be provided for an update');
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_VECTOR_UPDATE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }

    try {
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
        namespace: indexName,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_VECTOR_UPDATE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
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
      await this.client.delete(id, {
        namespace: indexName,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_VECTOR_DELETE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }
}
