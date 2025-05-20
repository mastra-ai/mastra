import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
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

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
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

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
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

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: QueryVectorParams): Promise<QueryResult[]> {
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
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
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

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
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
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
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
