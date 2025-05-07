import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  ParamsToArgs,
  QueryVectorArgs,
  UpsertVectorArgs,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { MongoClient } from 'mongodb';
import type { MongoClientOptions, Document, Db, Collection } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

import { MongoDBFilterTranslator } from './filter';

// Define necessary types and interfaces
export type MongoDBUpsertArgs = [...UpsertVectorArgs, string[]?];
export type MongoDBQueryArgs = [...QueryVectorArgs, string?];
export type MongoDBUpsertParams = ParamsToArgs<MongoDBUpsertArgs>;

export interface MongoDBUpsertVectorParams extends UpsertVectorParams {
  documents?: string[];
}

export interface MongoDBQueryVectorParams extends QueryVectorParams {
  documentFilter?: VectorFilter;
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
export class MongoDBVector extends MastraVector {
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
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  async createIndex(params: CreateIndexParams): Promise<void> {
    const { indexName, dimension, metric = 'cosine' } = params;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }

    const mongoMetric = this.mongoMetricMap[metric];
    if (!mongoMetric) {
      throw new Error(`Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`);
    }

    // Check if collection exists
    const collectionExists = await this.db.listCollections({ name: indexName }).hasNext();
    if (!collectionExists) {
      await this.db.createCollection(indexName);
    }
    const collection = await this.getCollection(indexName);

    const indexNameInternal = `${indexName}_vector_index`;

    const embeddingField = this.embeddingFieldName;
    const numDimensions = dimension;

    try {
      // Create the search index
      await (collection as any).createSearchIndex({
        definition: {
          fields: [
            {
              type: 'vector',
              path: embeddingField,
              numDimensions: numDimensions,
              similarity: mongoMetric,
            },
          ],
        },
        name: indexNameInternal,
        type: 'vectorSearch',
      });
    } catch (error: any) {
      if (error.codeName !== 'IndexAlreadyExists') {
        throw error;
      }
    }

    // Store the dimension and metric in a special metadata document
    await collection.updateOne({ _id: '__index_metadata__' }, { $set: { dimension, metric } }, { upsert: true });
  }

  async waitForIndexReady(indexName: string, timeoutMs: number = 60000, checkIntervalMs: number = 2000): Promise<void> {
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

  async upsert(params: MongoDBUpsertVectorParams): Promise<string[]> {
    const { indexName, vectors, metadata, ids, documents } = params;

    const collection = await this.getCollection(indexName);

    this.collectionForValidation = collection;

    // Get index stats to check dimension
    const stats = await this.describeIndex(indexName);

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
  }

  async query(params: MongoDBQueryVectorParams): Promise<QueryResult[]> {
    const { indexName, queryVector, topK = 10, filter, includeVector = false, documentFilter } = params;

    const collection = await this.getCollection(indexName, true);
    const indexNameInternal = `${indexName}_vector_index`;

    // Transform the filters using MongoDBFilterTranslator
    const mongoFilter = this.transformFilter(filter);
    const documentMongoFilter = documentFilter ? { [this.documentFieldName]: documentFilter } : {};

    // Combine the filters
    let combinedFilter: any = {};
    if (Object.keys(mongoFilter).length > 0 && Object.keys(documentMongoFilter).length > 0) {
      combinedFilter = { $and: [mongoFilter, documentMongoFilter] };
    } else if (Object.keys(mongoFilter).length > 0) {
      combinedFilter = mongoFilter;
    } else if (Object.keys(documentMongoFilter).length > 0) {
      combinedFilter = documentMongoFilter;
    }

    // Build the aggregation pipeline
    const pipeline = [
      {
        $vectorSearch: {
          index: indexNameInternal,
          queryVector: queryVector,
          path: this.embeddingFieldName,
          numCandidates: 100,
          limit: topK,
        },
      },
      // Apply the filter using $match stage
      ...(Object.keys(combinedFilter).length > 0 ? [{ $match: combinedFilter }] : []),
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

    try {
      const results = await collection.aggregate(pipeline).toArray();

      return results.map((result: any) => ({
        id: result._id,
        score: result.score,
        metadata: result.metadata,
        vector: includeVector ? result.vector : undefined,
        document: result.document,
      }));
    } catch (error) {
      console.error('Error during vector search:', error);
      throw error;
    }
  }

  async listIndexes(): Promise<string[]> {
    const collections = await this.db.listCollections().toArray();
    return collections.map(col => col.name);
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
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
  }

  async deleteIndex(indexName: string): Promise<void> {
    const collection = await this.getCollection(indexName, false); // Do not throw error if collection doesn't exist
    if (collection) {
      await collection.drop();
      this.collections.delete(indexName);
    } else {
      // Optionally, you can log or handle the case where the collection doesn't exist
      throw new Error(`Index (Collection) "${indexName}" does not exist`);
    }
  }

  async updateIndexById(
    indexName: string,
    id: string,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    if (!update.vector && !update.metadata) {
      throw new Error('No updates provided');
    }

    const collection = await this.getCollection(indexName, true);
    const updateDoc: Record<string, any> = {};

    if (update.vector) {
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
  }

  async deleteIndexById(indexName: string, id: string): Promise<void> {
    try {
      const collection = await this.getCollection(indexName, true);
      await collection.deleteOne({ _id: id });
    } catch (error: any) {
      throw new Error(`Failed to delete index by id: ${id} for index name: ${indexName}: ${error.message}`);
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

  private transformFilter(filter?: VectorFilter): any {
    const translator = new MongoDBFilterTranslator();
    if (!filter) return {};
    return translator.translate(filter);
  }
}
