import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
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
} from '@mastra/core/vector';
import { MongoClient } from 'mongodb';
import type { MongoClientOptions, Document, Db, Collection } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

import { MongoDBFilterTranslator } from './filter';
import type { MongoDBVectorFilter } from './filter';

// Define necessary types and interfaces
export interface MongoDBUpsertVectorParams extends UpsertVectorParams {
  documents?: string[];
}

interface MongoDBQueryVectorParams extends QueryVectorParams<MongoDBVectorFilter> {
  documentFilter?: MongoDBVectorFilter;
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
  private readonly embeddingFieldName = 'embedding';
  private readonly metadataFieldName = 'metadata';
  private readonly documentFieldName = 'document';
  private collectionForValidation: Collection<MongoDBDocument> | null = null;
  private mongoMetricMap: { [key: string]: string } = {
    cosine: 'cosine',
    euclidean: 'euclidean',
    dotproduct: 'dotProduct',
  };

  constructor({ uri, dbName, options }: { uri: string; dbName: string; options?: MongoClientOptions }) {
    super();
    this.client = new MongoClient(uri, options);
    this.db = this.client.db(dbName);
    this.collections = new Map();
  }

  // Public methods
  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_VECTOR_CONNECT_FAILED',
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
          id: 'STORAGE_MONGODB_VECTOR_DISCONNECT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
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
          id: 'STORAGE_MONGODB_VECTOR_CREATE_INDEX_INVALID_ARGS',
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

      // Create search indexes
      await collection.createSearchIndex({
        definition: {
          fields: [
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
          ],
        },
        name: indexNameInternal,
        type: 'vectorSearch',
      });
      await collection.createSearchIndex({
        definition: {
          mappings: {
            dynamic: true,
          },
        },
        name: `${indexName}_search_index`,
        type: 'search',
      });
    } catch (error: any) {
      if (error.codeName !== 'IndexAlreadyExists') {
        throw new MastraError(
          {
            id: 'STORAGE_MONGODB_VECTOR_CREATE_INDEX_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
          },
          error,
        );
      }
    }

    try {
      // Store the dimension and metric in a special metadata document
      await collection?.updateOne({ _id: '__index_metadata__' }, { $set: { dimension, metric } }, { upsert: true });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_VECTOR_CREATE_INDEX_FAILED_STORE_METADATA',
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

  async upsert({ indexName, vectors, metadata, ids, documents }: MongoDBUpsertVectorParams): Promise<string[]> {
    try {
      const collection = await this.getCollection(indexName);

      this.collectionForValidation = collection;

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
          id: 'STORAGE_MONGODB_VECTOR_UPSERT_FAILED',
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
  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    documentFilter,
  }: MongoDBQueryVectorParams): Promise<QueryResult[]> {
    try {
      const collection = await this.getCollection(indexName, true);
      const indexNameInternal = `${indexName}_vector_index`;

      // Transform the filters using MongoDBFilterTranslator
      const mongoFilter = this.transformFilter(filter);
      const documentMongoFilter = documentFilter ? { [this.documentFieldName]: documentFilter } : {};

      // Transform metadata field filters to use dot notation
      const transformedMongoFilter = this.transformMetadataFilter(mongoFilter);

      // Combine the filters
      let combinedFilter: any = {};
      if (Object.keys(transformedMongoFilter).length > 0 && Object.keys(documentMongoFilter).length > 0) {
        combinedFilter = { $and: [transformedMongoFilter, documentMongoFilter] };
      } else if (Object.keys(transformedMongoFilter).length > 0) {
        combinedFilter = transformedMongoFilter;
      } else if (Object.keys(documentMongoFilter).length > 0) {
        combinedFilter = documentMongoFilter;
      }

      const vectorSearch: Document = {
        index: indexNameInternal,
        queryVector: queryVector,
        path: this.embeddingFieldName,
        numCandidates: 100,
        limit: topK,
      };

      if (Object.keys(combinedFilter).length > 0) {
        // pre-filter for candidate document IDs
        const candidateIds = await collection
          .aggregate([{ $match: combinedFilter }, { $project: { _id: 1 } }])
          .map(doc => doc._id)
          .toArray();

        if (candidateIds.length > 0) {
          vectorSearch.filter = { _id: { $in: candidateIds } };
        } else {
          // No documents match the filter, return empty results
          return [];
        }
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
          id: 'STORAGE_MONGODB_VECTOR_QUERY_FAILED',
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
          id: 'STORAGE_MONGODB_VECTOR_LIST_INDEXES_FAILED',
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

      // Get the count of documents, excluding the metadata document
      const count = await collection.countDocuments({ _id: { $ne: '__index_metadata__' } });

      // Retrieve the dimension and metric from the metadata document
      const metadataDoc = await collection.findOne({ _id: '__index_metadata__' });
      const dimension = metadataDoc?.dimension || 0;
      const metric = metadataDoc?.metric || 'cosine';

      return {
        dimension,
        count,
        metric: metric as 'cosine' | 'euclidean' | 'dotproduct',
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_VECTOR_DESCRIBE_INDEX_FAILED',
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

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    const collection = await this.getCollection(indexName, false); // Do not throw error if collection doesn't exist
    try {
      if (collection) {
        await collection.drop();
        this.collections.delete(indexName);
      } else {
        // Optionally, you can log or handle the case where the collection doesn't exist
        throw new Error(`Index (Collection) "${indexName}" does not exist`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_VECTOR_DELETE_INDEX_FAILED',
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
  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
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

      await collection.findOneAndUpdate({ _id: id }, { $set: updateDoc });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_VECTOR_UPDATE_VECTOR_FAILED',
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
          id: 'STORAGE_MONGODB_VECTOR_DELETE_VECTOR_FAILED',
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

  // Private methods
  private async getCollection(
    indexName: string,
    throwIfNotExists: boolean = true,
  ): Promise<Collection<MongoDBDocument>> {
    if (this.collections.has(indexName)) {
      return this.collections.get(indexName)!;
    }

    const collection = this.db.collection<MongoDBDocument>(indexName);

    // Check if collection exists
    const collectionExists = await this.db.listCollections({ name: indexName }).hasNext();
    if (!collectionExists && throwIfNotExists) {
      throw new Error(`Index (Collection) "${indexName}" does not exist`);
    }

    this.collections.set(indexName, collection);
    return collection;
  }

  private async validateVectorDimensions(vectors: number[][], dimension: number): Promise<void> {
    if (vectors.length === 0) {
      throw new Error('No vectors provided for validation');
    }

    if (dimension === 0) {
      // If dimension is not set, retrieve and set it from the vectors
      dimension = vectors[0] ? vectors[0].length : 0;
      await this.setIndexDimension(dimension);
    }

    for (let i = 0; i < vectors.length; i++) {
      let v = vectors[i]?.length;
      if (v !== dimension) {
        throw new Error(`Vector at index ${i} has invalid dimension ${v}. Expected ${dimension} dimensions.`);
      }
    }
  }

  private async setIndexDimension(dimension: number): Promise<void> {
    // Store the dimension in a special metadata document
    const collection = this.collectionForValidation!; // 'collectionForValidation' is set in 'upsert' method
    await collection.updateOne({ _id: '__index_metadata__' }, { $set: { dimension } }, { upsert: true });
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

    const transformed: any = {};

    for (const [key, value] of Object.entries(filter)) {
      // Check if this is a MongoDB operator (starts with $)
      if (key.startsWith('$')) {
        // For logical operators like $and, $or, recursively transform their contents
        if (Array.isArray(value)) {
          transformed[key] = value.map(item => this.transformMetadataFilter(item));
        } else {
          transformed[key] = this.transformMetadataFilter(value);
        }
      }
      // Check if the key already has 'metadata.' prefix
      else if (key.startsWith('metadata.')) {
        // Already prefixed, keep as is
        transformed[key] = value;
      }
      // Check if this is a known metadata field that needs prefixing
      else if (this.isMetadataField(key)) {
        // Add metadata. prefix for fields stored in metadata subdocument
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
