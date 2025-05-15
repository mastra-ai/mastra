import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  ParamsToArgs,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
  IndexStats,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import Cloudflare from 'cloudflare';

import { VectorizeFilterTranslator } from './filter';

export class CloudflareVector extends MastraVector {
  client: Cloudflare;
  accountId: string;

  constructor({ accountId, apiToken }: { accountId: string; apiToken: string }) {
    super();
    this.accountId = accountId;

    this.client = new Cloudflare({
      apiToken: apiToken,
    });
  }

  get indexSeparator(): string {
    return '-';
  }

  async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);

    const { indexName, vectors, metadata, ids } = params;

    const generatedIds = ids || vectors.map(() => crypto.randomUUID());

    // Create NDJSON string - each line is a JSON object
    const ndjson = vectors
      .map((vector, index) =>
        JSON.stringify({
          id: generatedIds[index]!,
          values: vector,
          metadata: metadata?.[index],
        }),
      )
      .join('\n');

    // Note: __binaryRequest is required for proper NDJSON handling
    await this.client.vectorize.indexes.upsert(
      indexName,
      {
        account_id: this.accountId,
        body: ndjson,
      },
      {
        __binaryRequest: true,
      },
    );

    return generatedIds;
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new VectorizeFilterTranslator();
    return translator.translate(filter);
  }

  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);
    const { indexName, dimension, metric = 'cosine' } = params;

    try {
      await this.client.vectorize.indexes.create({
        account_id: this.accountId,
        config: {
          dimensions: dimension,
          metric: metric === 'dotproduct' ? 'dot-product' : metric,
        },
        name: indexName,
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
      // For any other errors, propagate
      throw error;
    }
  }

  async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams>('query', args);

    const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

    const translatedFilter = this.transformFilter(filter) ?? {};
    const response = await this.client.vectorize.indexes.query(indexName, {
      account_id: this.accountId,
      vector: queryVector,
      returnValues: includeVector,
      returnMetadata: 'all',
      topK,
      filter: translatedFilter,
    });

    return (
      response?.matches?.map((match: any) => {
        return {
          id: match.id,
          metadata: match.metadata,
          score: match.score,
          vector: match.values,
        };
      }) || []
    );
  }

  async listIndexes(): Promise<string[]> {
    const res = await this.client.vectorize.indexes.list({
      account_id: this.accountId,
    });

    return res?.result?.map(index => index.name!) || [];
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param params - The parameters for describing an index
   * @param params.indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex(...args: ParamsToArgs<DescribeIndexParams>): Promise<IndexStats> {
    const params = this.normalizeArgs<DescribeIndexParams>('describeIndex', args);
    const { indexName } = params;

    const index = await this.client.vectorize.indexes.get(indexName, {
      account_id: this.accountId,
    });

    const described = await this.client.vectorize.indexes.info(indexName, {
      account_id: this.accountId,
    });

    return {
      dimension: described?.dimensions!,
      // Since vector_count is not available in the response,
      // we might need a separate API call to get the count if needed
      count: described?.vectorCount || 0,
      metric: index?.config?.metric as 'cosine' | 'euclidean' | 'dotproduct',
    };
  }

  async deleteIndex(...args: ParamsToArgs<DeleteIndexParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteIndexParams>('deleteIndex', args);
    const { indexName } = params;

    await this.client.vectorize.indexes.delete(indexName, {
      account_id: this.accountId,
    });
  }

  async createMetadataIndex(indexName: string, propertyName: string, indexType: 'string' | 'number' | 'boolean') {
    await this.client.vectorize.indexes.metadataIndex.create(indexName, {
      account_id: this.accountId,
      propertyName,
      indexType,
    });
  }

  async deleteMetadataIndex(indexName: string, propertyName: string) {
    await this.client.vectorize.indexes.metadataIndex.delete(indexName, {
      account_id: this.accountId,
      propertyName,
    });
  }

  async listMetadataIndexes(indexName: string) {
    const res = await this.client.vectorize.indexes.metadataIndex.list(indexName, {
      account_id: this.accountId,
    });

    return res?.metadataIndexes ?? [];
  }

  /**
   * @deprecated Use {@link updateVector} instead. This method will be removed on May 20th, 2025.
   *
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateIndexById(
    indexName: string,
    id: string,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    this.logger.warn(
      `Deprecation Warning: updateIndexById() is deprecated. 
      Please use updateVector() instead. 
      updateIndexById() will be removed on May 20th, 2025.`,
    );
    await this.updateVector({ indexName, id, update });
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
  async updateVector(...args: ParamsToArgs<UpdateVectorParams>): Promise<void> {
    const params = this.normalizeArgs<UpdateVectorParams>('updateVector', args);
    const { indexName, id, update } = params;
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No update data provided');
      }

      const updatePayload: any = {
        ids: [id],
        account_id: this.accountId,
      };

      if (update.vector) {
        updatePayload.vectors = [update.vector];
      }
      if (update.metadata) {
        updatePayload.metadata = [update.metadata];
      }

      await this.upsert({ indexName: indexName, vectors: updatePayload.vectors, metadata: updatePayload.metadata });
    } catch (error: any) {
      throw new Error(`Failed to update vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }

  /**
   * @deprecated Use {@link deleteVector} instead. This method will be removed on May 20th, 2025.
   *
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteIndexById(indexName: string, id: string): Promise<void> {
    this.logger.warn(
      `Deprecation Warning: deleteIndexById() is deprecated. 
      Please use deleteVector() instead. 
      deleteIndexById() will be removed on May 20th, 2025.`,
    );
    await this.deleteVector({ indexName, id });
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector(...args: ParamsToArgs<DeleteVectorParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteVectorParams>('deleteVector', args);
    const { indexName, id } = params;

    try {
      await this.client.vectorize.indexes.deleteByIds(indexName, {
        ids: [id],
        account_id: this.accountId,
      });
    } catch (error: any) {
      throw new Error(`Failed to delete vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }
}
