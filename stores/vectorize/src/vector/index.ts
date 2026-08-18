import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
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
  DeleteVectorsParams,
} from '@mastra/core/vector';
import Cloudflare from 'cloudflare';

import { VectorizeFilterTranslator } from './filter';
import type { VectorizeVectorFilter } from './filter';

type VectorizeQueryParams = QueryVectorParams<VectorizeVectorFilter>;

export class CloudflareVector extends MastraVector<VectorizeVectorFilter> {
  client: Cloudflare;
  accountId: string;

  constructor({ accountId, apiToken, id }: { accountId: string; apiToken: string } & { id: string }) {
    super({ id });
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

    try {
      const body = new File([ndjson], `${indexName}.ndjson`, { type: 'application/x-ndjson' });

      await this.client.vectorize.indexes.upsert(indexName, {
        account_id: this.accountId,
        body,
      });

      return generatedIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, vectorCount: vectors?.length },
        },
        error,
      );
    }
  }

  transformFilter(filter?: VectorizeVectorFilter) {
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
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: VectorizeQueryParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('VECTORIZE', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Vectorize queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
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
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'QUERY', 'FAILED'),
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
      const res = await this.client.vectorize.indexes.list({
        account_id: this.accountId,
      });

      return res?.result?.map((index: { name?: string }) => index.name!) || [];
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'LIST_INDEXES', 'FAILED'),
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
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'DESCRIBE_INDEX', 'FAILED'),
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
      await this.client.vectorize.indexes.delete(indexName, {
        account_id: this.accountId,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async createMetadataIndex(indexName: string, propertyName: string, indexType: 'string' | 'number' | 'boolean') {
    try {
      await this.client.vectorize.indexes.metadataIndex.create(indexName, {
        account_id: this.accountId,
        propertyName,
        indexType,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'CREATE_METADATA_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, propertyName, indexType },
        },
        error,
      );
    }
  }

  async deleteMetadataIndex(indexName: string, propertyName: string) {
    try {
      await this.client.vectorize.indexes.metadataIndex.delete(indexName, {
        account_id: this.accountId,
        propertyName,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'DELETE_METADATA_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, propertyName },
        },
        error,
      );
    }
  }

  async listMetadataIndexes(indexName: string) {
    try {
      const res = await this.client.vectorize.indexes.metadataIndex.list(indexName, {
        account_id: this.accountId,
      });

      return res?.metadataIndexes ?? [];
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'LIST_METADATA_INDEXES', 'FAILED'),
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
    if (!id) {
      throw new MastraError({
        id: createVectorErrorId('VECTORIZE', 'UPDATE_VECTOR', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'id is required for Vectorize updateVector',
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('VECTORIZE', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No update data provided',
        details: { indexName, id },
      });
    }

    if (!update.vector) {
      throw new MastraError({
        id: createVectorErrorId('VECTORIZE', 'UPDATE_VECTOR', 'MISSING_VECTOR'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Vectorize requires vector values when updating; metadata-only updates are not supported. Provide update.vector alongside update.metadata.',
        details: { indexName, id },
      });
    }

    try {
      await this.upsert({
        indexName,
        ids: [id],
        vectors: [update.vector],
        ...(update.metadata && { metadata: [update.metadata] }),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'UPDATE_VECTOR', 'FAILED'),
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
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'DELETE_VECTOR', 'FAILED'),
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
   * Deletes multiple vectors by their IDs.
   *
   * Vectorize has no filtered-delete primitive, so metadata-filter deletion is rejected.
   *
   * @param indexName - The name of the index containing the vectors.
   * @param ids - The IDs of the vectors to delete. Mutually exclusive with `filter`.
   * @throws Will throw an error if the arguments are invalid or the deletion operation fails.
   */
  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams): Promise<void> {
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('VECTORIZE', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both ids and filter - they are mutually exclusive',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (filter) {
      throw new MastraError({
        id: createVectorErrorId('VECTORIZE', 'DELETE_VECTORS', 'UNSUPPORTED_FILTER'),
        text: 'Deleting by metadata filter is not supported for Vectorize vector store - delete by ids instead',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        details: { indexName, filter: JSON.stringify(filter) },
      });
    }

    if (!ids) {
      throw new MastraError({
        id: createVectorErrorId('VECTORIZE', 'DELETE_VECTORS', 'NO_TARGET'),
        text: 'Either filter or ids must be provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('VECTORIZE', 'DELETE_VECTORS', 'EMPTY_IDS'),
        text: 'Cannot delete with empty ids array',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      await this.client.vectorize.indexes.deleteByIds(indexName, {
        ids,
        account_id: this.accountId,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('VECTORIZE', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            idsCount: ids.length,
          },
        },
        error,
      );
    }
  }
}
