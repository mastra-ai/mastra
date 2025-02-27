import type { Db } from '@datastax/astra-db-ts';
import { DataAPIClient, UUID } from '@datastax/astra-db-ts';
import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  VectorFilter,
  ParamsToArgs,
} from '@mastra/core/vector';

import { AstraFilterTranslator } from './filter';

// Mastra and Astra DB agree on cosine and euclidean, but Astra DB uses dot_product instead of dotproduct.
const metricMap = {
  cosine: 'cosine',
  euclidean: 'euclidean',
  dotproduct: 'dot_product',
} as const;

export interface AstraDbOptions {
  token: string;
  endpoint: string;
  keyspace?: string;
}

export class AstraVector extends MastraVector {
  readonly #db: Db;

  constructor({ token, endpoint, keyspace }: AstraDbOptions) {
    super();
    const client = new DataAPIClient(token);
    this.#db = client.db(endpoint, { keyspace });
  }

  /**
   * Creates a new collection with the specified configuration.
   *
   * @param {string} indexName - The name of the collection to create.
   * @param {number} dimension - The dimension of the vectors to be stored in the collection.
   * @param {'cosine' | 'euclidean' | 'dotproduct'} [metric=cosine] - The metric to use to sort vectors in the collection.
   * @returns {Promise<void>} A promise that resolves when the collection is created.
   */
  // async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);

    const { indexName, dimension, metric = 'cosine' } = params;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    await this.#db.createCollection(indexName, {
      vector: {
        dimension,
        metric: metricMap[metric],
      },
      checkExists: false,
    });
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

    const { indexName, vectors, metadata, ids } = params;

    const collection = this.#db.collection(indexName);

    // Generate IDs if not provided
    const vectorIds = ids || vectors.map(() => UUID.v7().toString());

    const records = vectors.map((vector, i) => ({
      id: vectorIds[i],
      $vector: vector,
      metadata: metadata?.[i] || {},
    }));

    const result = await collection.insertMany(records);
    return result.insertedIds.map(id => (id || '').toString());
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new AstraFilterTranslator();
    return translator.translate(filter);
  }

  /**
   * Queries the specified collection using a vector and optional filter.
   *
   * @param {string} indexName - The name of the collection to query.
   * @param {number[]} queryVector - The vector to query with.
   * @param {number} [topK] - The maximum number of results to return.
   * @param {Record<string, any>} [filter] - An optional filter to apply to the query. For more on filters in Astra DB, see the filtering reference: https://docs.datastax.com/en/astra-db-serverless/api-reference/documents.html#operators
   * @param {boolean} [includeVectors=false] - Whether to include the vectors in the response.
   * @returns {Promise<QueryResult[]>} A promise that resolves to an array of query results.
   */
  async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams>('query', args);

    const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

    const collection = this.#db.collection(indexName);

    const translatedFilter = this.transformFilter(filter);

    const cursor = collection.find(translatedFilter ?? {}, {
      sort: { $vector: queryVector },
      limit: topK,
      includeSimilarity: true,
      projection: {
        $vector: includeVector ? true : false,
      },
    });

    const results = await cursor.toArray();

    return results.map(result => ({
      id: result.id,
      score: result.$similarity,
      metadata: result.metadata,
      ...(includeVector && { vector: result.$vector }),
    }));
  }

  /**
   * Lists all collections in the database.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array of collection names.
   */
  listIndexes(): Promise<string[]> {
    return this.#db.listCollections({ nameOnly: true });
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    const collection = this.#db.collection(indexName);
    const optionsPromise = collection.options();
    const countPromise = collection.countDocuments({}, 100);
    const [options, count] = await Promise.all([optionsPromise, countPromise]);

    console.log(options, count);

    const keys = Object.keys(metricMap) as (keyof typeof metricMap)[];
    const metric = keys.find(key => metricMap[key] === options.vector?.metric);
    return {
      dimension: options.vector?.dimension!,
      metric,
      count: count,
    };
  }

  /**
   * Deletes the specified collection.
   *
   * @param {string} indexName - The name of the collection to delete.
   * @returns {Promise<void>} A promise that resolves when the collection is deleted.
   */
  async deleteIndex(indexName: string): Promise<void> {
    const collection = this.#db.collection(indexName);
    await collection.drop();
  }
}
