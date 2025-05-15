import type { Db } from '@datastax/astra-db-ts';
import { DataAPIClient, UUID } from '@datastax/astra-db-ts';
import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  ParamsToArgs,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';

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

    await collection.insertMany(records);
    return vectorIds;
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

    const collection = this.#db.collection(indexName);
    const optionsPromise = collection.options();
    const countPromise = collection.countDocuments({}, 100);
    const [options, count] = await Promise.all([optionsPromise, countPromise]);

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
  async deleteIndex(...args: ParamsToArgs<DeleteIndexParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteIndexParams>('deleteIndex', args);

    const { indexName } = params;
    const collection = this.#db.collection(indexName);
    await collection.drop();
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
      `Deprecation Warning: updateIndexById() is deprecated. Please use updateVector() instead. updateIndexById() will be removed on May 20th, 2025.`,
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
        throw new Error('No updates provided');
      }

      const collection = this.#db.collection(indexName);
      const updateDoc: Record<string, any> = {};

      if (update.vector) {
        updateDoc.$vector = update.vector;
      }

      if (update.metadata) {
        updateDoc.metadata = update.metadata;
      }

      await collection.findOneAndUpdate({ id }, { $set: updateDoc });
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
      const collection = this.#db.collection(indexName);
      await collection.deleteOne({ id });
    } catch (error: any) {
      throw new Error(`Failed to delete vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }
}
