import { v4 as uuidv4 } from '@lukeed/uuid';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector, validateUpsertInput, validateVectorValues } from '@mastra/core/vector';
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
import { MongoClient } from 'mongodb';
import type { MongoClientOptions, Document, Db, Collection } from 'mongodb';
import packageJson from '../../package.json';

import { MongoDBFilterTranslator } from './filter';
import type { MongoDBVectorFilter } from './filter';

// Define necessary types and interfaces
export interface MongoDBUpsertVectorParams extends UpsertVectorParams {
  documents?: string[];
}

export interface MongoDBQueryVectorParams extends QueryVectorParams<MongoDBVectorFilter> {
  documentFilter?: MongoDBVectorFilter;
  /**
   * Number of candidates the HNSW graph considers before selecting the
   * top-K results. Higher values improve recall at the cost of latency.
   * Must be >= topK. Defaults to 20 * topK, capped at 10000.
   * See: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/
   */
  numCandidates?: number;
}

export interface MongoDBCreateIndexParams extends CreateIndexParams {
  /**
   * Metadata field names to declare as filter fields in the Atlas vectorSearch
   * index (registered as `metadata.<field>`). Queries whose metadata filter
   * only touches declared fields — using operators `$vectorSearch.filter`
   * supports — are passed directly to `$vectorSearch` instead of pre-filtering
   * candidate `_id`s, avoiding the 16 MB BSON limit on large result sets.
   * Filters that reference an undeclared field, or use an unsupported
   * operator, automatically fall back to the pre-filter.
   * @see https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/
   */
  filterFields?: string[];
}

export interface MongoDBVectorConfig {
  /** Unique identifier for this vector store instance */
  id: string;
  /** MongoDB connection string */
  uri: string;
  /** Name of the MongoDB database to use */
  dbName: string;
  /** Optional MongoDB client options */
  options?: MongoClientOptions;
  /**
   * Path to the field that stores vector embeddings.
   * Supports nested paths using dot notation (e.g., 'text.contentEmbedding').
   * @default 'embedding'
   */
  embeddingFieldPath?: string;
}

export interface MongoDBIndexReadyParams {
  indexName: string;
  timeoutMs?: number;
  checkIntervalMs?: number;
}

// Define the document interface
interface MongoDBDocument extends Document {
  _id: string; // Explicitly declare '_id' as string
  embedding?: number[];
  metadata?: Record<string, any>;
  document?: string;
  [key: string]: any; // Index signature for additional properties
}
// The MongoDBVector class
export class MongoDBVector extends MastraVector<MongoDBVectorFilter> {
  private client: MongoClient;
  private db: Db;
  private collections: Map<string, Collection<MongoDBDocument>>;
  private readonly embeddingFieldName: string;
  private readonly metadataFieldName = 'metadata';
  private readonly documentFieldName = 'document';
  /**
   * Per-index cache of the filter paths declared in the Atlas vectorSearch index
   * (e.g. `document`, `metadata.category`). Populated when an index is created in
   * this process and lazily hydrated from the live index definition otherwise.
   * `_id` is excluded because it is materialised separately by the fallback path.
   */
  private declaredFilterPaths: Map<string, Set<string>> = new Map();
  /**
   * MongoDB query operators supported inside `$vectorSearch.filter`. Intentionally
   * conservative: filters using any operator outside this set fall back to the
   * `$match` pre-filter, which supports the full query language. Widening this set
   * is safe only for operators Atlas Vector Search actually accepts in `filter`.
   */
  private static readonly PUSHDOWN_OPERATORS = new Set([
    '$and',
    '$or',
    '$eq',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$nin',
  ]);
  private mongoMetricMap: { [key: string]: string } = {
    cosine: 'cosine',
    euclidean: 'euclidean',
    dotproduct: 'dotProduct',
  };

  constructor({ id, uri, dbName, options, embeddingFieldPath }: MongoDBVectorConfig) {
    super({ id });

    if (!uri) {
      throw new Error('MongoDBVector requires a connection string. Provide "uri" in the constructor options.');
    }

    const client = new MongoClient(uri, {
      ...options,
      driverInfo: {
        name: 'mastra-vector',
        version: packageJson.version || '0.0.0',
      },
    });
    this.client = client;
    this.db = this.client.db(dbName);
    this.collections = new Map();
    this.embeddingFieldName = embeddingFieldPath ?? 'embedding';
  }

  // Public methods
  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'CONNECT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DISCONNECT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Creates a MongoDB collection and the Atlas Search indexes that back a
   * Mastra index with the given name.
   *
   * **Async index lifecycle:** Atlas Search indexes transition through
   * PENDING → BUILDING → READY after this method returns. If you need to
   * `upsert` or `query` immediately after calling `createIndex`, call
   * `waitForIndexReady({ indexName })` first to block until the index is
   * queryable. Skipping that step on a real Atlas cluster may cause
   * "index not found" or "index not ready" errors on subsequent operations.
   */
  async createIndex({
    indexName,
    dimension,
    metric = 'cosine',
    filterFields,
  }: MongoDBCreateIndexParams): Promise<void> {
    let mongoMetric;
    try {
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }

      mongoMetric = this.mongoMetricMap[metric];
      if (!mongoMetric) {
        throw new Error(`Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            indexName,
            dimension,
            metric,
          },
        },
        error,
      );
    }

    let collection;
    try {
      // Check if collection exists
      const collectionExists = await this.db.listCollections({ name: indexName }).hasNext();
      if (!collectionExists) {
        await this.db.createCollection(indexName);
      }
      collection = await this.getCollection(indexName);

      const indexNameInternal = `${indexName}_vector_index`;

      const embeddingField = this.embeddingFieldName;
      const numDimensions = dimension;

      // Create search indexes.
      // Note that fast filtering can be done during vector search, but only if
      // we know the fields when the index is created.
      // '_id' and 'document' are always declared as filter fields. 'document'
      // lets documentFilter queries be passed directly to $vectorSearch without
      // materialising candidate IDs.
      // Metadata fields are arbitrary and unknown at index-creation time, so by
      // default they are not declared. Callers can declare the metadata fields
      // they intend to filter on via `filterFields`; those are registered as
      // `metadata.<field>` filter fields so filtered queries skip the $match /
      // $in pre-filter. See https://github.com/mastra-ai/mastra/issues/18587.
      const declaredMetadataPaths = this.buildDeclaredMetadataPaths(filterFields);
      const fields: Document[] = [
        {
          type: 'vector',
          path: embeddingField,
          numDimensions: numDimensions,
          similarity: mongoMetric,
        },
        {
          type: 'filter',
          path: '_id',
        },
        {
          type: 'filter',
          path: this.documentFieldName,
        },
        ...declaredMetadataPaths.map(path => ({ type: 'filter', path })),
      ];

      // Each creation treats IndexAlreadyExists as a no-op independently. A
      // shared catch would let an existing vector index skip creation of the
      // companion full-text index entirely (e.g. after a previously
      // interrupted createIndex), leaving the pair in a partial state.
      const vectorIndexCreated = await this.createSearchIndexIgnoringExisting(collection, {
        definition: { fields },
        name: indexNameInternal,
        type: 'vectorSearch',
      });

      // Cache the declared filter paths only when this call actually created
      // the index. An index that already existed may carry a different
      // declaration; queries hydrate the real one lazily via
      // getDeclaredFilterPaths().
      if (vectorIndexCreated) {
        this.declaredFilterPaths.set(indexName, new Set([this.documentFieldName, ...declaredMetadataPaths]));
      }

      await this.createSearchIndexIgnoringExisting(collection, {
        definition: {
          mappings: {
            dynamic: true,
          },
        },
        name: `${indexName}_search_index`,
        type: 'search',
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Creates an Atlas Search index, treating IndexAlreadyExists as a no-op so
   * `createIndex` stays idempotent per index. Returns true when the index was
   * actually created by this call.
   */
  private async createSearchIndexIgnoringExisting(
    collection: Collection<MongoDBDocument>,
    description: { definition: Document; name: string; type: 'vectorSearch' | 'search' },
  ): Promise<boolean> {
    try {
      await collection.createSearchIndex(description);
      return true;
    } catch (error: any) {
      if (error?.codeName === 'IndexAlreadyExists') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Waits for the index to be ready.
   *
   * @param {string} indexName - The name of the index to wait for
   * @param {number} timeoutMs - The maximum time in milliseconds to wait for the index to be ready (default: 60000)
   * @param {number} checkIntervalMs - The interval in milliseconds at which to check if the index is ready (default: 2000)
   * @returns A promise that resolves when the index is ready
   */
  async waitForIndexReady({
    indexName,
    timeoutMs = 60000,
    checkIntervalMs = 2000,
  }: MongoDBIndexReadyParams): Promise<void> {
    const collection = await this.getCollection(indexName, true);
    const indexNameInternal = `${indexName}_vector_index`;

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const indexInfo: any[] = await (collection as any).listSearchIndexes().toArray();
      const indexData = indexInfo.find((idx: any) => idx.name === indexNameInternal);
      const status = indexData?.status;
      if (status === 'READY') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    throw new Error(`Index "${indexNameInternal}" did not become ready within timeout`);
  }

  /**
   * Inserts or updates vectors in the specified index.
   *
   * @param indexName - Name of the index (MongoDB collection) to write into.
   * @param vectors - Array of embedding vectors. Each must have the same
   *   dimension as declared when the index was created.
   * @param metadata - Optional array of metadata objects, one per vector,
   *   stored in a nested `metadata` field alongside the embedding.
   * @param ids - Optional string IDs for each vector, used as the MongoDB
   *   document `_id`. Auto-generated UUIDs are used when omitted.
   * @param documents - Optional text strings associated with each vector,
   *   stored in a `document` field.
   * @returns The IDs of the upserted vectors in input order.
   */
  async upsert({ indexName, vectors, metadata, ids, documents }: MongoDBUpsertVectorParams): Promise<string[]> {
    // Validate input parameters
    validateUpsertInput('MONGODB', vectors, metadata, ids);
    validateVectorValues('MONGODB', vectors);

    try {
      const collection = await this.getCollection(indexName);

      // Get index stats to check dimension
      const stats = await this.describeIndex({ indexName });

      // Validate vector dimensions
      await this.validateVectorDimensions(vectors, stats.dimension);

      // Generate IDs if not provided
      const generatedIds = ids || vectors.map(() => uuidv4());

      const operations = vectors.map((vector, idx) => {
        const id = generatedIds[idx];
        const meta = metadata?.[idx] || {};
        const doc = documents?.[idx];

        // Normalize metadata - convert Date objects to ISO strings
        const normalizedMeta = Object.keys(meta).reduce(
          (acc, key) => {
            acc[key] = meta[key] instanceof Date ? meta[key].toISOString() : meta[key];
            return acc;
          },
          {} as Record<string, any>,
        );

        const updateDoc: Partial<MongoDBDocument> = {
          [this.embeddingFieldName]: vector,
          [this.metadataFieldName]: normalizedMeta,
        };
        if (doc !== undefined) {
          updateDoc[this.documentFieldName] = doc;
        }

        return {
          updateOne: {
            filter: { _id: id }, // '_id' is a string as per MongoDBDocument interface
            update: { $set: updateDoc },
            upsert: true,
          },
        };
      });

      await collection.bulkWrite(operations);

      return generatedIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }
  /**
   * Runs an approximate nearest-neighbor search against the specified index.
   *
   * @param indexName - Name of the index (MongoDB collection) to search.
   * @param queryVector - The query embedding. Must match the index dimension.
   * @param topK - Maximum number of results to return (default: 10).
   * @param filter - Optional metadata filter. Fields are matched against the
   *   nested `metadata` subdocument; no `metadata.` prefix is needed.
   * @param includeVector - When true, each result includes the stored embedding
   *   in a `vector` field (default: false).
   * @param documentFilter - Optional filter applied to the `document` text
   *   field, independent of `filter`.
   * @param numCandidates - HNSW candidate pool size. Higher values improve
   *   recall at the cost of latency. Defaults to 20 * topK, capped at 10000.
   * @returns Array of results ordered by descending similarity score.
   */
  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    documentFilter,
    numCandidates,
  }: MongoDBQueryVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for MongoDB queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      const collection = await this.getCollection(indexName, true);
      const indexNameInternal = `${indexName}_vector_index`;

      // Metadata filter: translate then add 'metadata.' prefix to user-facing field names.
      const metadataFilter = this.transformMetadataFilter(this.transformFilter(filter));
      const hasMetadataFilter = Object.keys(metadataFilter).length > 0;

      const vectorSearch: Document = {
        index: indexNameInternal,
        queryVector: queryVector,
        path: this.embeddingFieldName,
        numCandidates: Math.min(10000, Math.max(topK, numCandidates ?? topK * 20)),
        limit: Math.min(10000, topK),
      };

      if (hasMetadataFilter) {
        // Fast path: if every field the filter touches was declared via
        // `filterFields` at index creation, and every operator is one Atlas
        // Vector Search accepts inside `filter`, pass the metadata filter
        // straight to $vectorSearch — no $match, no _id materialisation, no
        // 16 MB BSON ceiling. See https://github.com/mastra-ai/mastra/issues/18587
        let declaredPaths: Set<string>;
        try {
          declaredPaths = await this.getDeclaredFilterPaths(indexName);
        } catch {
          // If the declaration can't be read, assume nothing is declared and
          // use the always-correct pre-filter below.
          declaredPaths = new Set();
        }

        if (this.canPushDownFilter(metadataFilter, declaredPaths)) {
          vectorSearch.filter = documentFilter
            ? { $and: [metadataFilter, { [this.documentFieldName]: documentFilter }] }
            : metadataFilter;
        } else {
          // Fallback: metadata fields are not (all) declared as filter fields, or
          // the filter uses an operator $vectorSearch doesn't support. Materialise
          // matching _ids via $match first, then filter by _id inside $vectorSearch.
          const candidateIds = await collection
            .aggregate([{ $match: metadataFilter }, { $project: { _id: 1 } }])
            .map(doc => doc._id)
            .toArray();

          if (candidateIds.length === 0) return [];

          // 'document' is a declared filter field — combine directly when present.
          vectorSearch.filter = documentFilter
            ? { $and: [{ _id: { $in: candidateIds } }, { [this.documentFieldName]: documentFilter }] }
            : { _id: { $in: candidateIds } };
        }
      } else if (documentFilter) {
        // 'document' is a declared filter field in the index — pass directly,
        // no candidate materialisation needed.
        vectorSearch.filter = { [this.documentFieldName]: documentFilter };
      }

      // Build the aggregation pipeline
      const pipeline = [
        {
          $vectorSearch: vectorSearch,
        },
        {
          $set: { score: { $meta: 'vectorSearchScore' } },
        },
        {
          $project: {
            _id: 1,
            score: 1,
            metadata: `$${this.metadataFieldName}`,
            document: `$${this.documentFieldName}`,
            ...(includeVector && { vector: `$${this.embeddingFieldName}` }),
          },
        },
      ];

      const results = await collection.aggregate(pipeline).toArray();

      return results.map((result: any) => ({
        id: result._id,
        score: result.score,
        metadata: result.metadata,
        vector: includeVector ? result.vector : undefined,
        document: result.document,
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const collections = await this.db.listCollections().toArray();
      return collections.map(col => col.name);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'LIST_INDEXES', 'FAILED'),
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
      const collection = await this.getCollection(indexName, true);

      const count = await collection.countDocuments({ _id: { $ne: '__index_metadata__' as any } });

      const indexNameInternal = `${indexName}_vector_index`;
      const indexInfo: any[] = await (collection as any).listSearchIndexes().toArray();
      const indexData = indexInfo.find((idx: any) => idx.name === indexNameInternal);

      if (!indexData) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'DESCRIBE_INDEX', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `Atlas Search index "${indexNameInternal}" does not exist on collection "${indexName}". The collection may predate Mastra or the index may have been dropped externally.`,
        });
      }

      const vectorField = indexData.latestDefinition?.fields?.find((f: any) => f.type === 'vector');
      if (!vectorField) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'DESCRIBE_INDEX', 'INVALID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `Atlas Search index "${indexNameInternal}" exists but has no vector field. The index may have been created outside of Mastra or without vector configuration.`,
        });
      }
      const dimension = vectorField.numDimensions;
      const reverseMetricMap: Record<string, 'cosine' | 'euclidean' | 'dotproduct'> = {
        cosine: 'cosine',
        euclidean: 'euclidean',
        dotProduct: 'dotproduct',
      };
      const metric = reverseMetricMap[vectorField.similarity] ?? 'cosine';

      return { dimension, count, metric };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    const collection = await this.getCollection(indexName, false); // Do not throw error if collection doesn't exist
    try {
      if (collection) {
        await collection.drop();
        this.collections.delete(indexName);
        this.declaredFilterPaths.delete(indexName);
      } else {
        // Optionally, you can log or handle the case where the collection doesn't exist
        throw new Error(`Index (Collection) "${indexName}" does not exist`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
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
  async updateVector(params: UpdateVectorParams<MongoDBVectorFilter>): Promise<void> {
    const { indexName, update } = params;

    // Validate that both id and filter are not provided at the same time
    if ('id' in params && params.id && 'filter' in params && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'id and filter are mutually exclusive - provide only one',
      });
    }

    // Check if neither id nor filter is provided
    if (!('id' in params || 'filter' in params) || (!params.id && !params.filter)) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either id or filter must be provided',
        details: { indexName },
      });
    }

    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

      const collection = await this.getCollection(indexName, true);
      const updateDoc: Record<string, any> = {};

      if (update.vector) {
        const stats = await this.describeIndex({ indexName });
        await this.validateVectorDimensions([update.vector], stats.dimension);
        updateDoc[this.embeddingFieldName] = update.vector;
      }

      if (update.metadata) {
        // Normalize metadata in updates too
        const normalizedMeta = Object.keys(update.metadata).reduce(
          (acc, key) => {
            acc[key] =
              update.metadata![key] instanceof Date ? update.metadata![key].toISOString() : update.metadata![key];
            return acc;
          },
          {} as Record<string, any>,
        );

        updateDoc[this.metadataFieldName] = normalizedMeta;
      }

      // Type narrowing: check if updating by id or by filter
      if ('id' in params && params.id) {
        // Update by ID
        await collection.findOneAndUpdate({ _id: params.id }, { $set: updateDoc });
      } else if ('filter' in params && params.filter) {
        // Update by filter
        const filter = params.filter;

        if (!filter || Object.keys(filter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Cannot update with empty filter',
          });
        }

        const mongoFilter = this.transformFilter(filter);
        const transformedFilter = this.transformMetadataFilter(mongoFilter);

        if (!transformedFilter || Object.keys(transformedFilter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'INVALID_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Filter produced empty query',
          });
        }

        // Update multiple documents matching the filter
        await collection.updateMany(transformedFilter, { $set: updateDoc });
      }
    } catch (error: any) {
      // If it's already a MastraError, rethrow it
      if (error instanceof MastraError) {
        throw error;
      }

      const errorDetails: Record<string, any> = { indexName };

      if ('id' in params && params.id) {
        errorDetails.id = params.id;
      }

      if ('filter' in params && params.filter) {
        errorDetails.filter = JSON.stringify(params.filter);
      }

      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: errorDetails,
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
      const collection = await this.getCollection(indexName, true);
      await collection.deleteOne({ _id: id });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DELETE_VECTOR', 'FAILED'),
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

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<MongoDBVectorFilter>): Promise<void> {
    // Validate that exactly one of filter or ids is provided
    if (!filter && !ids) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'Either filter or ids must be provided',
      });
    }

    if (filter && ids) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'Cannot provide both filter and ids - they are mutually exclusive',
      });
    }

    try {
      const collection = await this.getCollection(indexName, true);

      if (ids) {
        // Delete by IDs
        if (ids.length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'EMPTY_IDS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Cannot delete with empty ids array',
          });
        }

        await collection.deleteMany({ _id: { $in: ids } });
      } else {
        // Delete by filter
        // Safety check: Don't allow empty filters to prevent accidental deletion of all vectors
        if (!filter || Object.keys(filter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'EMPTY_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Cannot delete with empty filter',
          });
        }

        const mongoFilter = this.transformFilter(filter);
        const transformedFilter = this.transformMetadataFilter(mongoFilter);

        if (!transformedFilter || Object.keys(transformedFilter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'INVALID_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Filter produced empty query',
          });
        }

        await collection.deleteMany(transformedFilter);
      }
    } catch (error) {
      // If it's already a MastraError, rethrow it
      if (error instanceof MastraError) {
        throw error;
      }

      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'FAILED'),
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

  /**
   * Returns the MongoDB Collection that backs the given Mastra index.
   *
   * **Index vs. collection:** In this driver, each Mastra index is stored as a
   * MongoDB collection whose name equals the index name. The Atlas Vector Search
   * index (named `${indexName}_vector_index`) lives on that collection. The two
   * terms are distinct: "index" is the Mastra concept; "collection" is the
   * MongoDB storage primitive that implements it.
   *
   * **Caching:** Collection handles are cached on first successful lookup to
   * avoid redundant `listCollections` round-trips. Only handles for collections
   * that actually exist are cached; a handle for a missing collection is returned
   * without being cached so the next call re-checks existence rather than
   * returning a stale phantom.
   *
   * @param indexName - Mastra index name, which is also the MongoDB collection name.
   * @param throwIfNotExists - When `true` (default), throws if no MongoDB
   *   collection exists for this index name. Pass `false` when absence is not an
   *   error (e.g., inside `deleteIndex`).
   */
  private async getCollection(
    indexName: string,
    throwIfNotExists: boolean = true,
  ): Promise<Collection<MongoDBDocument>> {
    if (this.collections.has(indexName)) {
      return this.collections.get(indexName)!;
    }

    const collection = this.db.collection<MongoDBDocument>(indexName);

    const collectionExists = await this.db.listCollections({ name: indexName }).hasNext();
    if (!collectionExists && throwIfNotExists) {
      throw new Error(
        `Mastra index "${indexName}" has no backing MongoDB collection. ` +
          `Call createIndex first, or verify the collection was not dropped externally.`,
      );
    }

    if (collectionExists) {
      this.collections.set(indexName, collection);
    }
    return collection;
  }

  private async validateVectorDimensions(vectors: number[][], dimension: number): Promise<void> {
    if (vectors.length === 0) {
      throw new Error('No vectors provided for validation');
    }

    if (dimension === 0) {
      dimension = vectors[0] ? vectors[0].length : 0;
    }

    for (let i = 0; i < vectors.length; i++) {
      let v = vectors[i]?.length;
      if (v !== dimension) {
        throw new Error(`Vector at index ${i} has invalid dimension ${v}. Expected ${dimension} dimensions.`);
      }
    }
  }

  /**
   * Maps user-facing `filterFields` (bare metadata field names) to the fully
   * qualified filter paths stored in the index, e.g. `category` → `metadata.category`.
   * Blank entries are dropped and duplicates collapsed. A name already carrying the
   * `metadata.` prefix is left untouched so callers can pass either form.
   */
  private buildDeclaredMetadataPaths(filterFields?: string[]): string[] {
    if (!filterFields?.length) return [];
    const paths = new Set<string>();
    for (const field of filterFields) {
      const trimmed = field?.trim();
      if (!trimmed) continue;
      paths.add(trimmed.startsWith(`${this.metadataFieldName}.`) ? trimmed : `${this.metadataFieldName}.${trimmed}`);
    }
    return [...paths];
  }

  /**
   * Returns the set of filter paths declared in the vectorSearch index (e.g.
   * `document`, `metadata.category`), excluding `_id`. Reads the live index
   * definition once per index and caches the result. Used to decide whether a
   * metadata filter can be pushed down into `$vectorSearch.filter`.
   */
  private async getDeclaredFilterPaths(indexName: string): Promise<Set<string>> {
    const cached = this.declaredFilterPaths.get(indexName);
    if (cached) return cached;

    const collection = await this.getCollection(indexName, true);
    const indexNameInternal = `${indexName}_vector_index`;
    const indexInfo: any[] = await (collection as any).listSearchIndexes().toArray();
    const indexData = indexInfo.find((idx: any) => idx.name === indexNameInternal);

    const paths = new Set<string>();

    // `latestDefinition` is the most recently *requested* definition, not
    // necessarily the one serving queries: while an index update is building,
    // Atlas keeps answering queries with the previous definition. Trusting a
    // staged definition could push a filter down onto an active index that
    // does not support it yet, so the definition is only read — and cached —
    // once the index reports READY. Until then (missing, PENDING, BUILDING,
    // or a transient read miss) return the empty set uncached: queries take
    // the always-correct pre-filter fallback and a later call re-reads the
    // definition instead of pushdown being permanently disabled.
    if (indexData?.status !== 'READY') {
      return paths;
    }

    for (const field of indexData.latestDefinition?.fields ?? []) {
      if (field?.type === 'filter' && typeof field.path === 'string' && field.path !== '_id') {
        paths.add(field.path);
      }
    }

    this.declaredFilterPaths.set(indexName, paths);
    return paths;
  }

  /**
   * True when `filter` can be passed directly to `$vectorSearch.filter`: every
   * field path it references is a declared filter field and every operator is in
   * {@link MongoDBVector.PUSHDOWN_OPERATORS}. Conservative by design — anything it
   * can't prove safe returns false so the caller uses the `$match` pre-filter.
   */
  private canPushDownFilter(filter: any, declaredPaths: Set<string>): boolean {
    if (filter === null || typeof filter !== 'object') return true;
    if (Array.isArray(filter)) return filter.every(item => this.canPushDownFilter(item, declaredPaths));

    for (const [key, value] of Object.entries(filter)) {
      if (key.startsWith('$')) {
        if (!MongoDBVector.PUSHDOWN_OPERATORS.has(key)) return false;
      } else if (!declaredPaths.has(key)) {
        return false;
      }
      if (!this.canPushDownFilter(value, declaredPaths)) return false;
    }
    return true;
  }

  private transformFilter(filter?: MongoDBVectorFilter) {
    const translator = new MongoDBFilterTranslator();
    if (!filter) return {};
    return translator.translate(filter);
  }

  /**
   * Transform metadata field filters to use MongoDB dot notation.
   * Fields that are stored in the metadata subdocument need to be prefixed with 'metadata.'
   * This handles filters from the Memory system which expects direct field access.
   *
   * @param filter - The filter object to transform
   * @returns Transformed filter with metadata fields properly prefixed
   */
  private transformMetadataFilter(filter: any): any {
    if (!filter || typeof filter !== 'object') return filter;

    // Handle arrays (shouldn't happen at top level, but be defensive)
    if (Array.isArray(filter)) {
      return filter.map(item => this.transformMetadataFilter(item));
    }

    const transformed: any = {};

    for (const [key, value] of Object.entries(filter)) {
      // Check if this is a MongoDB operator (starts with $)
      if (key.startsWith('$')) {
        // For logical operators like $and, $or, recursively transform their contents
        if (Array.isArray(value)) {
          transformed[key] = value.map(item => this.transformMetadataFilter(item));
        } else if (typeof value === 'object' && value !== null) {
          transformed[key] = this.transformMetadataFilter(value);
        } else {
          transformed[key] = value;
        }
      }
      // Check if the key already has 'metadata.' prefix
      else if (key.startsWith('metadata.')) {
        // Already prefixed — keep as-is.
        transformed[key] = value;
      }
      // Check if this is a known metadata field that needs prefixing
      else if (this.isMetadataField(key)) {
        // Add metadata. prefix for fields stored in metadata subdocument
        // If the value is an object with operators, keep the operators as-is
        transformed[`metadata.${key}`] = value;
      } else {
        // Keep other fields as is
        transformed[key] = value;
      }
    }

    return transformed;
  }

  /**
   * Determine if a field should be treated as a metadata field.
   * Common metadata fields include thread_id, resource_id, message_id, and any field
   * that doesn't start with underscore (MongoDB system fields).
   */
  private isMetadataField(key: string): boolean {
    // MongoDB system fields start with underscore
    if (key.startsWith('_')) return false;

    // Document-level fields that are NOT in metadata
    const documentFields = ['_id', this.embeddingFieldName, this.documentFieldName];
    if (documentFields.includes(key)) return false;

    // Everything else is assumed to be in metadata
    // This includes thread_id, resource_id, message_id, and any custom fields
    return true;
  }
}
