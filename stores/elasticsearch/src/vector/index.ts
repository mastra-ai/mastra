import { Client as ElasticSearchClient } from '@elastic/elasticsearch';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
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
import { MastraVector, validateUpsert, validateTopK } from '@mastra/core/vector';
import { ElasticSearchFilterTranslator } from './filter';
import type { ElasticSearchVectorFilter } from './filter';

const METRIC_MAPPING = {
  cosine: 'cosine',
  euclidean: 'l2_norm',
  dotproduct: 'dot_product',
} as const;

const REVERSE_METRIC_MAPPING = {
  cosine: 'cosine',
  l2_norm: 'euclidean',
  dot_product: 'dotproduct',
} as const;

type ElasticSearchVectorParams = QueryVectorParams<ElasticSearchVectorFilter>;

export type ElasticSearchAuth = { apiKey: string } | { username: string; password: string } | { bearer: string };

export class ElasticSearchVector extends MastraVector<ElasticSearchVectorFilter> {
  private client: ElasticSearchClient;

  /**
   * Creates a new ElasticSearchVector client.
   *
   * @param {string} url - The url of the ElasticSearch node.
   * @param {ElasticSearchAuth} [auth] - The authentication credentials for ElasticSearch.
   */
  constructor({ url, id, auth }: { url: string } & { id: string } & { auth?: ElasticSearchAuth }) {
    super({ id });
    this.client = new ElasticSearchClient({ node: url, ...(auth && { auth }) });
  }

  /**
   * Creates a new collection with the specified configuration.
   *
   * @param {string} indexName - The name of the collection to create.
   * @param {number} dimension - The dimension of the vectors to be stored in the collection.
   * @param {'cosine' | 'euclidean' | 'dotproduct'} [metric=cosine] - The metric to use to sort vectors in the collection.
   * @returns {Promise<void>} A promise that resolves when the collection is created.
   */
  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'CREATE_INDEX', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Dimension must be a positive integer',
        details: { indexName, dimension },
      });
    }

    try {
      await this.client.indices.create({
        index: indexName,
        mappings: {
          properties: {
            metadata: { type: 'object' },
            embedding: {
              type: 'dense_vector',
              dims: dimension,
              index: true,
              similarity: METRIC_MAPPING[metric],
            },
          },
        },
      });
    } catch (error: any) {
      const message = error?.message || error?.toString();
      if (message && message.toLowerCase().includes('already exists')) {
        // Fetch collection info and check dimension
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }
  }

  /**
   * Lists all indexes.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array of indexes.
   */
  async listIndexes(): Promise<string[]> {
    try {
      const response = await this.client.cat.indices({ format: 'json' });
      const indexes = response
        .map((record: { index?: string }) => record.index)
        .filter((index: string | undefined): index is string => index !== undefined && !index.startsWith('.'));

      return indexes;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Validates that an existing index matches the requested dimension and metric.
   * Throws an error if there's a mismatch, otherwise allows idempotent creation.
   */
  protected async validateExistingIndex(indexName: string, dimension: number, metric: string): Promise<void> {
    let info: IndexStats;
    try {
      info = await this.describeIndex({ indexName });
    } catch (infoError) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'VALIDATE_INDEX', 'FETCH_FAILED'),
          text: `Index "${indexName}" already exists, but failed to fetch index info for dimension check.`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          details: { indexName },
        },
        infoError,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      throw mastraError;
    }

    const existingDim = info?.dimension;
    const existingMetric = info?.metric;

    if (existingDim === dimension) {
      this.logger?.info(
        `Index "${indexName}" already exists with ${existingDim} dimensions and metric ${existingMetric}, skipping creation.`,
      );
      if (existingMetric !== metric) {
        this.logger?.warn(
          `Attempted to create index with metric "${metric}", but index already exists with metric "${existingMetric}". To use a different metric, delete and recreate the index.`,
        );
      }
    } else if (info) {
      const mastraError = new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'VALIDATE_INDEX', 'DIMENSION_MISMATCH'),
        text: `Index "${indexName}" already exists with ${existingDim} dimensions, but ${dimension} dimensions were requested`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, existingDim, requestedDim: dimension },
      });
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      throw mastraError;
    }
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const indexInfo = await this.client.indices.get({ index: indexName });
    const mappings = indexInfo[indexName]?.mappings;
    const embedding: any = mappings?.properties?.embedding;
    const similarity = embedding.similarity as keyof typeof REVERSE_METRIC_MAPPING;

    const countInfo = await this.client.count({ index: indexName });

    return {
      dimension: Number(embedding.dims),
      count: Number(countInfo.count),
      metric: REVERSE_METRIC_MAPPING[similarity],
    };
  }

  /**
   * Deletes the specified index.
   *
   * @param {string} indexName - The name of the index to delete.
   * @returns {Promise<void>} A promise that resolves when the index is deleted.
   */
  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      await this.client.indices.delete({ index: indexName }, { ignore: [404] });
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }

  /**
   * Inserts or updates vectors in the specified collection.
   *
   * @param {string} indexName - The name of the collection to upsert into.
   * @param {number[][]} vectors - An array of vectors to upsert.
   * @param {Record<string, any>[]} [metadata] - An optional array of metadata objects corresponding to each vector.
   * @param {string[]} [ids] - An optional array of IDs corresponding to each vector. If not provided, new IDs will be generated.
   * @returns {Promise<string[]>} A promise that resolves to an array of IDs of the upserted vectors.
   */
  async upsert({ indexName, vectors, metadata = [], ids }: UpsertVectorParams): Promise<string[]> {
    // Validate input parameters and vector values
    validateUpsert('ELASTICSEARCH', vectors, metadata, ids, true);

    const vectorIds = ids || vectors.map(() => crypto.randomUUID());
    const operations = [];

    try {
      // Get index stats to check dimension
      const indexInfo = await this.describeIndex({ indexName });

      // Validate vector dimensions
      this.validateVectorDimensions(vectors, indexInfo.dimension);

      for (let i = 0; i < vectors.length; i++) {
        const operation = {
          index: {
            _index: indexName,
            _id: vectorIds[i],
          },
        };

        const document = {
          embedding: vectors[i],
          metadata: metadata[i] || {},
        };

        operations.push(operation);
        operations.push(document);
      }

      if (operations.length > 0) {
        const response = await this.client.bulk({ operations, refresh: true });

        // Check for item-level errors in bulk response
        if (response.errors) {
          const failedItems: Array<{ id: string; status: number; error: any }> = [];
          const successfulIds: string[] = [];

          // Iterate through items to collect failures
          for (let i = 0; i < response.items.length; i++) {
            const item = response.items[i];
            if (!item) continue;
            const operationType = Object.keys(item)[0] as 'index' | 'create' | 'update' | 'delete';
            const operationResult = item[operationType];
            if (!operationResult) continue;

            if (operationResult.error) {
              // Extract the ID from the original operations array
              // Operations alternate: operation, document, operation, document...
              const operationIndex = i * 2;
              const operationDoc = operations[operationIndex] as { index?: { _id?: string } };
              const failedId = operationDoc?.index?._id || vectorIds[i] || `unknown-${i}`;

              failedItems.push({
                id: failedId,
                status: operationResult.status || 0,
                error: operationResult.error,
              });
            } else if (operationResult?.status && operationResult.status < 300) {
              // Success - extract ID
              const operationIndex = i * 2;
              const operationDoc = operations[operationIndex] as { index?: { _id?: string } };
              const successId = operationDoc?.index?._id || vectorIds[i];
              if (successId) {
                successfulIds.push(successId);
              }
            }
          }

          // If there are failures, log and throw error
          if (failedItems.length > 0) {
            const failedItemDetails = failedItems
              .map(item => `${item.id}: ${item.error?.reason || item.error?.type || JSON.stringify(item.error)}`)
              .join('; ');

            const mastraError = new MastraError(
              {
                id: createVectorErrorId('ELASTICSEARCH', 'UPSERT', 'BULK_PARTIAL_FAILURE'),
                text: `Bulk upsert partially failed: ${failedItems.length} of ${response.items.length} operations failed. Failed items: ${failedItemDetails}`,
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.THIRD_PARTY,
                details: {
                  indexName,
                  totalOperations: response.items.length,
                  failedCount: failedItems.length,
                  successfulCount: successfulIds.length,
                  failedItemIds: failedItems.map(item => item.id).join(','),
                  failedItemErrors: failedItemDetails,
                },
              },
              new Error(`Bulk operation had ${failedItems.length} failures`),
            );

            this.logger?.error(mastraError.toString());
            this.logger?.trackException(mastraError);

            // Throw error with details about failures
            throw mastraError;
          }
        }
      }

      return vectorIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, vectorCount: vectors?.length || 0 },
        },
        error,
      );
    }
  }

  /**
   * Queries the specified collection using a vector and optional filter.
   *
   * @param {string} indexName - The name of the collection to query.
   * @param {number[]} queryVector - The vector to query with.
   * @param {number} [topK] - The maximum number of results to return.
   * @param {Record<string, any>} [filter] - An optional filter to apply to the query.
   * @param {boolean} [includeVectors=false] - Whether to include the vectors in the response.
   * @returns {Promise<QueryResult[]>} A promise that resolves to an array of query results.
   */
  async query({
    indexName,
    queryVector,
    filter,
    topK = 10,
    includeVector = false,
  }: ElasticSearchVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Elasticsearch queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate topK parameter
    validateTopK('ELASTICSEARCH', topK);

    try {
      const translatedFilter = this.transformFilter(filter);

      // Decide which fields to fetch from _source
      const sourceFields = includeVector ? ['metadata', 'embedding'] : ['metadata'];

      const response = await this.client.search({
        index: indexName,
        knn: {
          field: 'embedding',
          query_vector: queryVector,
          k: topK,
          num_candidates: topK * 2,
          ...(translatedFilter ? { filter: translatedFilter } : {}),
        },
        _source: sourceFields,
      });

      const results = response.hits.hits.map((hit: any) => {
        const source = hit._source || {};
        return {
          id: String(hit._id),
          score: typeof hit._score === 'number' ? hit._score : 0,
          metadata: source.metadata || {},
          ...(includeVector && { vector: source.embedding as number[] }),
        };
      });

      return results;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, topK },
        },
        error,
      );
    }
  }

  /**
   * Validates the dimensions of the vectors.
   *
   * @param {number[][]} vectors - The vectors to validate.
   * @param {number} dimension - The dimension of the vectors.
   * @returns {void}
   */
  private validateVectorDimensions(vectors: number[][], dimension: number) {
    if (vectors.some(vector => vector.length !== dimension)) {
      throw new Error('Vector dimension does not match index dimension');
    }
  }

  /**
   * Transforms the filter to the ElasticSearch DSL.
   *
   * @param {ElasticSearchVectorFilter} filter - The filter to transform.
   * @returns {Record<string, any>} The transformed filter.
   */
  private transformFilter(filter?: ElasticSearchVectorFilter): any {
    const translator = new ElasticSearchFilterTranslator();
    return translator.translate(filter);
  }

  /**
   * Updates vectors by ID or filter with the provided vector and/or metadata.
   * @param params - Parameters containing either id or filter for targeting vectors to update
   * @param params.indexName - The name of the index containing the vector(s).
   * @param params.id - The ID of a single vector to update (mutually exclusive with filter).
   * @param params.filter - A filter to match multiple vectors to update (mutually exclusive with id).
   * @param params.update - An object containing the vector and/or metadata to update.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector(params: UpdateVectorParams<ElasticSearchVectorFilter>): Promise<void> {
    const { indexName, update } = params;

    // Validate mutually exclusive parameters
    if ('id' in params && 'filter' in params && params.id && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'id and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'UPDATE_VECTOR', 'NO_UPDATES'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No updates provided',
        details: { indexName },
      });
    }

    // Validate empty filter
    if ('filter' in params && params.filter && Object.keys(params.filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot update with empty filter',
        details: { indexName },
      });
    }

    // Type-narrowing: check if updating by id or by filter
    if ('id' in params && params.id) {
      // Update by ID
      await this.updateVectorById(indexName, params.id, update);
    } else if ('filter' in params && params.filter) {
      // Update by filter
      await this.updateVectorsByFilter(indexName, params.filter, update);
    } else {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'UPDATE_VECTOR', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either id or filter must be provided',
        details: { indexName },
      });
    }
  }

  /**
   * Updates a single vector by its ID.
   */
  private async updateVectorById(
    indexName: string,
    id: string,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    let existingDoc;
    try {
      // First get the current document to merge with updates
      const result = await this.client
        .get({
          index: indexName,
          id: id,
          _source: ['embedding', 'metadata'],
        })
        .catch(() => {
          throw new Error(`Document with ID ${id} not found in index ${indexName}`);
        });

      if (!result || !result._source) {
        throw new Error(`Document with ID ${id} has no source data in index ${indexName}`);
      }
      existingDoc = result;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            indexName,
            id,
          },
        },
        error,
      );
    }

    const source = existingDoc._source as any;
    const updatedDoc: Record<string, any> = {};

    try {
      // Update vector if provided
      if (update.vector) {
        // Get index stats to check dimension
        const indexInfo = await this.describeIndex({ indexName });

        // Validate vector dimensions
        this.validateVectorDimensions([update.vector], indexInfo.dimension);

        updatedDoc.embedding = update.vector;
      } else if (source?.embedding) {
        updatedDoc.embedding = source.embedding;
      }

      // Update metadata if provided
      if (update.metadata) {
        updatedDoc.metadata = update.metadata;
      } else {
        updatedDoc.metadata = source?.metadata || {};
      }

      // Update the document
      await this.client.index({
        index: indexName,
        id: id,
        document: updatedDoc,
        refresh: true,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            id,
          },
        },
        error,
      );
    }
  }

  /**
   * Updates multiple vectors matching a filter.
   */
  private async updateVectorsByFilter(
    indexName: string,
    filter: ElasticSearchVectorFilter,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    try {
      const translator = new ElasticSearchFilterTranslator();
      const translatedFilter = translator.translate(filter);

      // Build the update script
      const scriptSource: string[] = [];
      const scriptParams: Record<string, any> = {};

      if (update.vector) {
        scriptSource.push('ctx._source.embedding = params.embedding');
        scriptParams.embedding = update.vector;
      }

      if (update.metadata) {
        scriptSource.push('ctx._source.metadata = params.metadata');
        scriptParams.metadata = update.metadata;
      }

      // Use update_by_query to update all matching documents
      await this.client.updateByQuery({
        index: indexName,
        query: (translatedFilter as any) || { match_all: {} },
        script: {
          source: scriptSource.join('; '),
          params: scriptParams,
          lang: 'painless',
        },
        refresh: true,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'UPDATE_VECTOR_BY_FILTER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            filter: JSON.stringify(filter),
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
      await this.client.delete({
        index: indexName,
        id: id,
        refresh: true,
      });
    } catch (error: unknown) {
      // Don't throw error if document doesn't exist (404)
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return;
      }
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'DELETE_VECTOR', 'FAILED'),
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

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<ElasticSearchVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'ids and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'DELETE_VECTORS', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either filter or ids must be provided',
        details: { indexName },
      });
    }

    // Validate non-empty arrays and objects
    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'DELETE_VECTORS', 'EMPTY_IDS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot delete with empty ids array',
        details: { indexName },
      });
    }

    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('ELASTICSEARCH', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot delete with empty filter',
        details: { indexName },
      });
    }

    try {
      if (ids) {
        // Delete by IDs using bulk API
        const bulkBody = ids.flatMap(id => [{ delete: { _index: indexName, _id: id } }]);

        const response = await this.client.bulk({
          operations: bulkBody,
          refresh: true,
        });

        // Check for item-level errors in bulk response
        if (response.errors) {
          const failedItems: Array<{ id: string; status: number; error: any }> = [];
          const successfulIds: string[] = [];

          // Iterate through items to collect failures
          for (let i = 0; i < response.items.length; i++) {
            const item = response.items[i];
            if (!item) continue;
            const operationType = Object.keys(item)[0] as 'index' | 'create' | 'update' | 'delete';
            const operationResult = item[operationType];
            if (!operationResult) continue;

            if (operationResult.error) {
              // Extract the ID from the original operations array
              const operationIndex = i;
              const operationDoc = bulkBody[operationIndex] as { delete?: { _id?: string } };
              const failedId = operationDoc?.delete?._id || ids[i] || `unknown-${i}`;

              failedItems.push({
                id: failedId,
                status: operationResult.status || 0,
                error: operationResult.error,
              });
            } else if (operationResult?.status && operationResult.status < 300) {
              // Success - extract ID
              const operationIndex = i;
              const operationDoc = bulkBody[operationIndex] as { delete?: { _id?: string } };
              const successId = operationDoc?.delete?._id || ids[i];
              if (successId) {
                successfulIds.push(successId);
              }
            }
          }

          // If there are failures, log and throw error
          if (failedItems.length > 0) {
            const failedItemDetails = failedItems
              .map(item => `${item.id}: ${item.error?.reason || item.error?.type || JSON.stringify(item.error)}`)
              .join('; ');

            const mastraError = new MastraError(
              {
                id: createVectorErrorId('ELASTICSEARCH', 'DELETE_VECTORS', 'BULK_PARTIAL_FAILURE'),
                text: `Bulk delete partially failed: ${failedItems.length} of ${response.items.length} operations failed. Failed items: ${failedItemDetails}`,
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.THIRD_PARTY,
                details: {
                  indexName,
                  totalOperations: response.items.length,
                  failedCount: failedItems.length,
                  successfulCount: successfulIds.length,
                  failedItemIds: failedItems.map(item => item.id).join(','),
                  failedItemErrors: failedItemDetails,
                },
              },
              new Error(`Bulk delete operation had ${failedItems.length} failures`),
            );

            this.logger?.error(mastraError.toString());
            this.logger?.trackException(mastraError);

            // Throw error with details about failures
            throw mastraError;
          }
        }
      } else if (filter) {
        // Delete by filter using delete_by_query
        const translator = new ElasticSearchFilterTranslator();
        const translatedFilter = translator.translate(filter);

        await this.client.deleteByQuery({
          index: indexName,
          query: (translatedFilter as any) || { match_all: {} },
          refresh: true,
        });
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('ELASTICSEARCH', 'DELETE_VECTORS', 'FAILED'),
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
