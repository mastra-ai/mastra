import type { Db } from '@datastax/astra-db-ts';
import { DataAPIClient, UUID } from '@datastax/astra-db-ts';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
  DeleteVectorsParams,
} from '@mastra/core/vector';
import type { AstraVectorFilter } from './filter';
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

type AstraQueryVectorParams = QueryVectorParams<AstraVectorFilter>;

export class AstraVector extends MastraVector<AstraVectorFilter> {
  readonly #db: Db;

  constructor({ token, endpoint, keyspace, id }: AstraDbOptions & { id: string }) {
    super({ id });
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
  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new MastraError({
        id: createVectorErrorId('ASTRA', 'CREATE_INDEX', 'INVALID_DIMENSION'),
        text: 'Dimension must be a positive integer',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
      });
    }
    try {
      await this.#db.createCollection(indexName, {
        vector: {
          dimension,
          metric: metricMap[metric],
        },
        checkExists: false,
      });
    } catch (error: any) {
      new MastraError(
        {
          id: createVectorErrorId('ASTRA', 'CREATE_INDEX', 'DB_ERROR'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
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
  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    const collection = this.#db.collection(indexName);

    // Generate IDs if not provided
    const vectorIds = ids || vectors.map(() => UUID.v7().toString());

    const records = vectors.map((vector, i) => ({
      id: vectorIds[i],
      $vector: vector,
      metadata: metadata?.[i] || {},
    }));

    try {
      await collection.insertMany(records);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('ASTRA', 'UPSERT', 'DB_ERROR'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
    return vectorIds;
  }

  transformFilter(filter?: AstraVectorFilter) {
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
  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: AstraQueryVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('ASTRA', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Astra queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    const collection = this.#db.collection(indexName);

    const translatedFilter = this.transformFilter(filter);

    try {
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
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('ASTRA', 'QUERY', 'DB_ERROR'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Lists all collections in the database.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array of collection names.
   */
  async listIndexes(): Promise<string[]> {
    try {
      return await this.#db.listCollections({ nameOnly: true });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('ASTRA', 'LIST_INDEXES', 'DB_ERROR'),
          domain: ErrorDomain.MASTRA_VECTOR,
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
    const collection = this.#db.collection(indexName);
    try {
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
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('ASTRA', 'DESCRIBE_INDEX', 'DB_ERROR'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Deletes the specified collection.
   *
   * @param {string} indexName - The name of the collection to delete.
   * @returns {Promise<void>} A promise that resolves when the collection is deleted.
   */
  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    const collection = this.#db.collection(indexName);
    try {
      await collection.drop();
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('ASTRA', 'DELETE_INDEX', 'DB_ERROR'),
          domain: ErrorDomain.MASTRA_VECTOR,
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
        id: createVectorErrorId('ASTRA', 'UPDATE_VECTOR', 'NO_ID'),
        text: 'id is required for Astra updateVector',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('ASTRA', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        text: 'No updates provided for vector',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: {
          indexName,
          id,
        },
      });
    }

    try {
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('ASTRA', 'UPDATE_VECTOR', 'FAILED_UNHANDLED'),
          domain: ErrorDomain.MASTRA_VECTOR,
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
      const collection = this.#db.collection(indexName);
      await collection.deleteOne({ id });
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('ASTRA', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
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

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams): Promise<void> {
    throw new MastraError({
      id: createVectorErrorId('ASTRA', 'DELETE_VECTORS', 'NOT_SUPPORTED'),
      text: 'deleteVectors is not yet implemented for Astra vector store',
      domain: ErrorDomain.MASTRA_VECTOR,
      category: ErrorCategory.SYSTEM,
      details: {
        indexName,
        ...(filter && { filter: JSON.stringify(filter) }),
        ...(ids && { idsCount: ids.length }),
      },
    });
  }
}
