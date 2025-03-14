import type {
  CreateIndexParams,
  IndexStats,
  ParamsToArgs,
  QueryResult,
  QueryVectorParams,
  UpsertVectorParams,
} from '@mastra/core';
import { MastraVector } from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { OpenSearchFilterTranslator } from './filter';

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

export class OpenSearchVector extends MastraVector {
  private client: OpenSearchClient;

  constructor(url: string) {
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
  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);
    const { indexName, dimension, metric = 'cosine' } = params;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
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
                  engine: 'nmslib',
                  parameters: { ef_construction: 128, m: 16 },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error(`Failed to create index ${indexName}:`, error);
      throw error;
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
        .map((index: { index: string }) => index.index)
        .filter((index: string) => index !== undefined);

      return indexes;
    } catch (error) {
      console.error('Failed to list indexes:', error);
      return [];
    }
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
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
  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.client.indices.delete({ index: indexName });
    } catch (error) {
      console.error(`Failed to delete index ${indexName}:`, error);
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
  async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);
    const { indexName, vectors, metadata = [], ids } = params;

    const vectorIds = ids || vectors.map(() => crypto.randomUUID());
    const operations = [];

    // Get index stats to check dimension
    const indexInfo = await this.describeIndex(indexName);

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

    try {
      if (operations.length > 0) {
        await this.client.bulk({ body: operations, refresh: true });
      }

      return vectorIds;
    } catch (error) {
      console.error('Failed to upsert vectors:', error);
      throw error;
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
  async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams>('query', args);
    const { indexName, queryVector, filter, topK = 10, includeVector = false } = params;

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
      console.error('Failed to query vectors:', error);
      return [];
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
   * @param {VectorFilter} filter - The filter to transform.
   * @returns {Record<string, any>} The transformed filter.
   */
  private transformFilter(filter?: VectorFilter) {
    const translator = new OpenSearchFilterTranslator();
    return translator.translate(filter);
  }
}
