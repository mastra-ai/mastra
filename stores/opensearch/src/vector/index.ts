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
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import type { ClientOptions } from '@opensearch-project/opensearch';
import { OpenSearchFilterTranslator } from './filter';
import type { OpenSearchVectorFilter } from './filter';

/**
 * Configuration for OpenSearchVector.
 *
 * Extends the OpenSearch ClientOptions with a required id.
 * All OpenSearch client options are supported (node, auth, ssl, compression, etc.).
 *
 * @example
 * ```typescript
 * // Simple URL config
 * const vector = new OpenSearchVector({
 *   id: 'my-vector',
 *   node: 'http://localhost:9200',
 * });
 *
 * // With authentication
 * const vector = new OpenSearchVector({
 *   id: 'my-vector',
 *   node: 'https://my-opensearch-cluster.com',
 *   auth: { username: 'admin', password: 'secret' },
 *   ssl: { rejectUnauthorized: false },
 * });
 * ```
 */
export type OpenSearchVectorConfig = ClientOptions & { id: string };

const METRIC_MAPPING = {
  cosine: 'cosinesimil',
  euclidean: 'l2',
  dotproduct: 'innerproduct',
} as const;

const REVERSE_METRIC_MAPPING = {
  cosinesimil: 'cosine',
  l2: 'euclidean',
  innerproduct: 'dotproduct',
} as const;

type OpenSearchVectorParams = QueryVectorParams<OpenSearchVectorFilter>;

export class OpenSearchVector extends MastraVector<OpenSearchVectorFilter> {
  private client: OpenSearchClient;

  /**
   * Creates a new OpenSearchVector client.
   *
   * @param config - OpenSearch client configuration options plus a required id.
   * @see OpenSearchVectorConfig for all available options.
   */
  constructor({ id, ...clientOptions }: OpenSearchVectorConfig) {
    super({ id });
    this.client = new OpenSearchClient(clientOptions);
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
        id: createVectorErrorId('OPENSEARCH', 'CREATE_INDEX', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Dimension must be a positive integer',
        details: { indexName, dimension },
      });
    }

    try {
      await this.client.indices.create({
        index: indexName,
        body: {
          settings: { index: { knn: true } },
          mappings: {
            properties: {
              metadata: { type: 'object' },
              id: { type: 'keyword' },
              embedding: {
                type: 'knn_vector',
                dimension: dimension,
                method: {
                  name: 'hnsw',
                  space_type: METRIC_MAPPING[metric],
                  engine: 'faiss',
                  parameters: { ef_construction: 128, m: 16 },
                },
              },
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
          id: createVectorErrorId('OPENSEARCH', 'CREATE_INDEX', 'FAILED'),
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
      const indexes = response.body
        .map((record: { index?: string }) => record.index)
        .filter((index: string | undefined) => index !== undefined);

      return indexes;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('OPENSEARCH', 'LIST_INDEXES', 'FAILED'),
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
    const { body: indexInfo } = await this.client.indices.get({ index: indexName });
    const mappings = indexInfo[indexName]?.mappings;
    const embedding: any = mappings?.properties?.embedding;
    const spaceType = embedding.method.space_type as keyof typeof REVERSE_METRIC_MAPPING;

    const { body: countInfo } = await this.client.count({ index: indexName });

    return {
      dimension: Number(embedding.dimension),
      count: Number(countInfo.count),
      metric: REVERSE_METRIC_MAPPING[spaceType],
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
      await this.client.indices.delete({ index: indexName });
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('OPENSEARCH', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
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
    validateUpsert('OPENSEARCH', vectors, metadata, ids, true);

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
          id: vectorIds[i],
          embedding: vectors[i],
          metadata: metadata[i] || {},
        };

        operations.push(operation);
        operations.push(document);
      }

      if (operations.length > 0) {
        await this.client.bulk({ body: operations, refresh: true });
      }

      return vectorIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('OPENSEARCH', 'UPSERT', 'FAILED'),
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
   * @param {Record<string, any>} [filter] - An optional filter to apply to the query. For more on filters in OpenSearch, see the filtering reference: https://opensearch.org/docs/latest/query-dsl/
   * @param {boolean} [includeVectors=false] - Whether to include the vectors in the response.
   * @returns {Promise<QueryResult[]>} A promise that resolves to an array of query results.
   */
  async query({
    indexName,
    queryVector,
    filter,
    topK = 10,
    includeVector = false,
  }: OpenSearchVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('OPENSEARCH', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for OpenSearch queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate topK parameter
    validateTopK('OPENSEARCH', topK);

    try {
      const translatedFilter = this.transformFilter(filter);

      const response = await this.client.search({
        index: indexName,
        body: {
          query: {
            bool: {
              must: { knn: { embedding: { vector: queryVector, k: topK } } },
              filter: translatedFilter ? [translatedFilter] : [],
            },
          },
          _source: ['id', 'metadata', 'embedding'],
        },
      });

      const results = response.body.hits.hits.map((hit: any) => {
        const source = hit._source || {};
        return {
          id: String(source.id || ''),
          score: typeof hit._score === 'number' ? hit._score : 0,
          metadata: source.metadata || {},
          ...(includeVector && { vector: source.embedding as number[] }),
        };
      });

      return results;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('OPENSEARCH', 'QUERY', 'FAILED'),
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
   * Transforms the filter to the OpenSearch DSL.
   *
   * @param {OpenSearchVectorFilter} filter - The filter to transform.
   * @returns {Record<string, any>} The transformed filter.
   */
  private transformFilter(filter?: OpenSearchVectorFilter): any {
    const translator = new OpenSearchFilterTranslator();
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
  async updateVector(params: UpdateVectorParams<OpenSearchVectorFilter>): Promise<void> {
    const { indexName, update } = params;

    // Validate mutually exclusive parameters
    if ('id' in params && 'filter' in params && params.id && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('OPENSEARCH', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'id and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('OPENSEARCH', 'UPDATE_VECTOR', 'NO_UPDATES'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No updates provided',
        details: { indexName },
      });
    }

    // Validate empty filter
    if ('filter' in params && params.filter && Object.keys(params.filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('OPENSEARCH', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
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
        id: createVectorErrorId('OPENSEARCH', 'UPDATE_VECTOR', 'NO_TARGET'),
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
      const { body } = await this.client
        .get({
          index: indexName,
          id: id,
        })
        .catch(() => {
          throw new Error(`Document with ID ${id} not found in index ${indexName}`);
        });

      if (!body || !body._source) {
        throw new Error(`Document with ID ${id} has no source data in index ${indexName}`);
      }
      existingDoc = body;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('OPENSEARCH', 'UPDATE_VECTOR', 'FAILED'),
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

    const source = existingDoc._source;
    const updatedDoc: Record<string, any> = {
      id: source?.id || id,
    };

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
        body: updatedDoc,
        refresh: true,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('OPENSEARCH', 'UPDATE_VECTOR', 'FAILED'),
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
    filter: OpenSearchVectorFilter,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    try {
      const translator = new OpenSearchFilterTranslator();
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
        body: {
          query: (translatedFilter as any) || { match_all: {} },
          script: {
            source: scriptSource.join('; '),
            params: scriptParams,
            lang: 'painless',
          },
        },
        refresh: true,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('OPENSEARCH', 'UPDATE_VECTOR_BY_FILTER', 'FAILED'),
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
          id: createVectorErrorId('OPENSEARCH', 'DELETE_VECTOR', 'FAILED'),
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

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<OpenSearchVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('OPENSEARCH', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'ids and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('OPENSEARCH', 'DELETE_VECTORS', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either filter or ids must be provided',
        details: { indexName },
      });
    }

    // Validate non-empty arrays and objects
    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('OPENSEARCH', 'DELETE_VECTORS', 'EMPTY_IDS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot delete with empty ids array',
        details: { indexName },
      });
    }

    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('OPENSEARCH', 'DELETE_VECTORS', 'EMPTY_FILTER'),
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

        await this.client.bulk({
          body: bulkBody,
          refresh: true,
        });
      } else if (filter) {
        // Delete by filter using delete_by_query
        const translator = new OpenSearchFilterTranslator();
        const translatedFilter = translator.translate(filter);

        await this.client.deleteByQuery({
          index: indexName,
          body: {
            query: (translatedFilter as any) || { match_all: {} },
          },
          refresh: true,
        });
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('OPENSEARCH', 'DELETE_VECTORS', 'FAILED'),
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
