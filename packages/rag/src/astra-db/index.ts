import { DataAPIClient, Db, UUID } from '@datastax/astra-db-ts';
import { MastraVector, QueryResult, IndexStats } from '@mastra/core';

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

export class AstraDb extends MastraVector {
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
  async createIndex(
    indexName: string,
    dimension: number,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  ): Promise<void> {
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
  async upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]> {
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

  /**
   * Queries the specified collection using a vector and optional filter.
   *
   * @param {string} indexName - The name of the collection to query.
   * @param {number[]} queryVector - The vector to query with.
   * @param {number} [topK] - The maximum number of results to return.
   * @param {Record<string, any>} [filter] - An optional filter to apply to the query. For more on filters in Astra DB, see the filtering reference: https://docs.datastax.com/en/astra-db-serverless/api-reference/documents.html#operators
   * @returns {Promise<QueryResult[]>} A promise that resolves to an array of query results.
   */
  async query(
    indexName: string,
    queryVector: number[],
    topK?: number,
    filter?: Record<string, any>,
  ): Promise<QueryResult[]> {
    const collection = this.#db.collection(indexName);

    const cursor = collection.find(filter ?? {}, {
      sort: { $vector: queryVector },
      limit: topK,
      includeSimilarity: true,
    });
    const results = await cursor.toArray();

    return results.map(result => ({
      id: result.id,
      score: result.$similarity,
      metadata: result.metadata,
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

  /**
   * Describes the collection by providing info on how the collection is configured.
   *
   * @param {string} indexName - The name of the Astra DB collection to describe.
   * @returns {Promise<IndexStats>} A promise that resolves to an object containing the collection statistics.
   *
   * The returned object contains the following properties:
   * - `dimension` (number | undefined): The dimension of the vector collection, if available.
   * - `metric` (string | undefined): The metric used for the vector collection, if available.
   * - `count` (number): The estimated number of documents in the collection. See [estimatedDocumentCount](https://docs.datastax.com/en/astra-db-serverless/api-reference/document-methods/count.html#estimate-document-count-in-a-collection) for more information on why this is an estimate.
   */
  async describeIndex(indexName: string): Promise<IndexStats> {
    const collection = this.#db.collection(indexName);
    const optionsPromise = collection.options();
    const estimatedCountPromise = collection.estimatedDocumentCount();
    const [options, estimatedCount] = await Promise.all([optionsPromise, estimatedCountPromise]);
    const keys = Object.keys(metricMap) as (keyof typeof metricMap)[];
    const metric = keys.find(key => metricMap[key] === options.vector?.metric);
    return {
      dimension: options.vector?.dimension,
      metric,
      count: estimatedCount,
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
