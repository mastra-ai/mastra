import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
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
import { MastraVector } from '@mastra/core/vector';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { OpenSearchFilterTranslator } from './filter';
import type { OpenSearchVectorFilter } from './filter';

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
   * @param {string} url - The url of the OpenSearch node.
   */
  constructor({ url }: { url: string }) {
    super();
    this.client = new OpenSearchClient({ node: url });
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
        id: 'STORAGE_OPENSEARCH_VECTOR_CREATE_INDEX_INVALID_ARGS',
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
          id: 'STORAGE_OPENSEARCH_VECTOR_CREATE_INDEX_FAILED',
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
          id: 'STORAGE_OPENSEARCH_VECTOR_LIST_INDEXES_FAILED',
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
          id: 'STORAGE_OPENSEARCH_VECTOR_DELETE_INDEX_FAILED',
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
          id: 'STORAGE_OPENSEARCH_VECTOR_UPSERT_FAILED',
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
          id: 'STORAGE_OPENSEARCH_VECTOR_QUERY_FAILED',
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
    let existingDoc;
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

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
          id: 'STORAGE_OPENSEARCH_VECTOR_UPDATE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, id },
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
        console.log(`1`);
        const indexInfo = await this.describeIndex({ indexName });

        // Validate vector dimensions
        console.log(`2`);
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
      console.log(`3`);
      await this.client.index({
        index: indexName,
        id: id,
        body: updatedDoc,
        refresh: true,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_OPENSEARCH_VECTOR_UPDATE_VECTOR_FAILED',
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
          id: 'STORAGE_OPENSEARCH_VECTOR_DELETE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }
}
