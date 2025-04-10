// Import necessary modules  
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
  
import { MongoClient, Db, Collection } from 'mongodb';  
import type { MongoClientOptions, Document } from 'mongodb';  
import type { VectorFilter } from '@mastra/core/vector/filter';  
  
// Import crypto module for generating UUIDs  
import * as crypto from 'crypto';  
  
// Implement a MongoFilterTranslator (placeholder implementation)  
class MongoFilterTranslator {  
  translate(filter?: VectorFilter): any {  
    // Implement your filter translation logic here  
    return filter || {};  
  }  
}  
  
// Define the document interface  
interface MongoDBDocument extends Document {  
  _id: string; // Explicitly declare '_id' as string  
  embedding?: number[];  
  metadata?: Record<string, any>;  
  document?: string;  
  [key: string]: any; // Index signature for additional properties  
}  
  
interface MongoDBUpsertVectorParams extends UpsertVectorParams {  
  documents?: string[];  
}  
  
type MongoDBUpsertArgs = [...UpsertVectorArgs, string[]?];  
  
interface MongoDBQueryVectorParams extends QueryVectorParams {  
  documentFilter?: VectorFilter;  
}  
  
type MongoDBQueryArgs = [...QueryVectorArgs, VectorFilter?];  
  
export class MongoDBVector extends MastraVector {  
  private client: MongoClient;  
  private db: Db;  
  private collections: Map<string, Collection<MongoDBDocument>>;  
  private readonly embeddingFieldName = 'embedding';  
  private readonly metadataFieldName = 'metadata';  
  private readonly documentFieldName = 'document';  
  
  constructor({ uri, dbName, options }: { uri: string; dbName: string; options?: MongoClientOptions }) {  
    super();  
    this.client = new MongoClient(uri, options);  
    this.db = this.client.db(dbName);  
    this.collections = new Map();  
  }  
  
  async connect(): Promise<void> {  
    await this.client.connect();  
  }  
  
  async close(): Promise<void> {  
    await this.client.close();  
  }  
  
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
    if (dimension === 0) {  
      // If dimension is not set, retrieve and set it from the vectors  
      dimension = vectors[0].length;  
      await this.setIndexDimension(vectors[0].length);  
    }  
  
    for (let i = 0; i < vectors.length; i++) {  
      if (vectors[i].length !== dimension) {  
        throw new Error(  
          `Vector at index ${i} has invalid dimension ${vectors[i].length}. Expected ${dimension} dimensions.`,  
        );  
      }  
    }  
  }  
  
  private async setIndexDimension(dimension: number): Promise<void> {  
    // Store the dimension in a special metadata document  
    const collection = this.collectionForValidation!; // 'collectionForValidation' is set in 'upsert' method  
    await collection.updateOne({ _id: '__index_metadata__' }, { $set: { dimension } }, { upsert: true });  
  }  
  
  private collectionForValidation: Collection<MongoDBDocument> | null = null;  
  
  async upsert(...args: ParamsToArgs<MongoDBUpsertVectorParams> | MongoDBUpsertArgs): Promise<string[]> {  
    const params = this.normalizeArgs<MongoDBUpsertVectorParams, MongoDBUpsertArgs>(  
      'upsert',  
      args,  
      ['documents'],  
    );  
  
    const { indexName, vectors, metadata, ids, documents } = params;  
  
    const collection = await this.getCollection(indexName);  
  
    this.collectionForValidation = collection;  
  
    // Get index stats to check dimension  
    const stats = await this.describeIndex(indexName);  
  
    // Validate vector dimensions  
    await this.validateVectorDimensions(vectors, stats.dimension);  
  
    // Generate IDs if not provided  
    const generatedIds = ids || vectors.map(() => crypto.randomUUID());  
  
    const operations = vectors.map((vector, idx) => {  
      const id = generatedIds[idx];  
      const meta = metadata?.[idx] || {};  
      const doc = documents?.[idx];  
  
      const updateDoc: Partial<MongoDBDocument> = {  
        [this.embeddingFieldName]: vector,  
        [this.metadataFieldName]: meta,  
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
  
  private mongoMetricMap: { [key: string]: string } = {  
    cosine: 'cosine',  
    euclidean: 'euclidean',  
    dotproduct: 'dotProduct',  
  };  
  
  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {  
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);  
  
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
  
    const indexNameInternal = `${this.embeddingFieldName}_vector_index`;  
  
    const embeddingField = this.embeddingFieldName;  
    const numDimensions = dimension;  
  
    const searchIndexModel = {  
      name: indexNameInternal,  
      definition: {  
        mappings: {  
          dynamic: false,  
          fields: {  
            [embeddingField]: {  
              type: 'knnVector',  
              dimensions: numDimensions,  
              similarity: mongoMetric,  
            },  
          },  
        },  
      },  
    };  
  
    try {  
      // Create the search index  
      await (collection as any).createSearchIndex(searchIndexModel);  
    } catch (error: any) {  
      if (error.codeName !== 'IndexAlreadyExists') {  
        throw error;  
      }  
    }  
  
    // Store the dimension and metric in a special metadata document  
    await collection.updateOne(  
      { _id: '__index_metadata__' },  
      { $set: { dimension, metric } },  
      { upsert: true },  
    );  
  }  
  
  private transformFilter(filter?: VectorFilter): any {  
    const translator = new MongoFilterTranslator();  
    return translator.translate(filter);  
  }  
  
  async query(...args: ParamsToArgs<MongoDBQueryVectorParams> | MongoDBQueryArgs): Promise<QueryResult[]> {  
    const params = this.normalizeArgs<MongoDBQueryVectorParams, MongoDBQueryArgs>(  
      'query',  
      args,  
      ['documentFilter'],  
    );  
  
    const { indexName, queryVector, topK = 10, filter, includeVector = false, documentFilter } =  
      params;  
  
    const collection = await this.getCollection(indexName, true);  
    const indexNameInternal = `${this.embeddingFieldName}_vector_index`;  
  
    const mongoFilter = this.transformFilter(filter);  
    const documentMongoFilter = documentFilter ? { [this.documentFieldName]: documentFilter } : {};  
  
    let combinedFilter: any = {};  
    if (Object.keys(mongoFilter).length > 0 && Object.keys(documentMongoFilter).length > 0) {  
      combinedFilter = { ...mongoFilter, ...documentMongoFilter };  
    } else if (Object.keys(mongoFilter).length > 0) {  
      combinedFilter = mongoFilter;  
    } else if (Object.keys(documentMongoFilter).length > 0) {  
      combinedFilter = documentMongoFilter;  
    }  
  
    let filterQuery: any = undefined;  
    if (Object.keys(combinedFilter).length > 0) {  
      filterQuery = {  
        compound: {  
          must: Object.entries(combinedFilter).map(([key, value]) => ({  
            equals: {  
              path: key,  
              value: value,  
            },  
          })),  
        },  
      };  
    }  
  
    const pipeline = [  
      {  
        $search: {  
          index: indexNameInternal,  
          knnBeta: {  
            vector: queryVector,  
            path: this.embeddingFieldName,  
            k: topK,  
          },  
          ...(filterQuery && { filter: filterQuery }),  
        },  
      },  
      {  
        $project: {  
          _id: 1,  
          score: { $meta: 'searchScore' },  
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
  }  
  
  async listIndexes(): Promise<string[]> {  
    const collections = await this.db.listCollections().toArray();  
    return collections.map((col) => col.name);  
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
    await this.db.dropCollection(indexName);  
    this.collections.delete(indexName);  
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
  
    const updateFields: Partial<MongoDBDocument> = {};  
    if (update.vector) {  
      updateFields[this.embeddingFieldName] = update.vector;  
    }  
    if (update.metadata) {  
      updateFields[this.metadataFieldName] = update.metadata;  
    }  
  
    await collection.updateOne({ _id: id }, { $set: updateFields });  
  }  
  
  async deleteIndexById(indexName: string, id: string): Promise<void> {  
    const collection = await this.getCollection(indexName, true);  
    await collection.deleteOne({ _id: id });  
  }  
  
  async waitForIndexReady(  
    indexName: string,  
    timeoutMs: number = 60000,  
    checkIntervalMs: number = 2000,  
  ): Promise<void> {  
    const collection = await this.getCollection(indexName, true);  
    const indexNameInternal = `${this.embeddingFieldName}_vector_index`;  
  
    const startTime = Date.now();  
    while (Date.now() - startTime < timeoutMs) {  
      const indexInfo: any[] = await (collection as any).listSearchIndexes().toArray();  
      const indexData = indexInfo.find((idx: any) => idx.name === indexNameInternal);  
      const status = indexData?.status;  
      if (status === 'READY') {  
        return;  
      }  
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));  
    }  
    throw new Error(`Index "${indexNameInternal}" did not become ready within timeout`);  
  }  
}  
  
// Demonstration (demo.ts)  
async function main() {  
  const mongoUri = 'mongodb://localhost:27017/?directConnection=true&serverSelectionTimeoutMS=2000';  
  const dbName = 'mastra_vector_db';  
  const indexName = 'my_index';  
  
  const mongoVector = new MongoDBVector({ uri: mongoUri, dbName });  
  
  try {  
    await mongoVector.connect();  
    console.log('Connected to MongoDB');  
  
    // Create Index  
    const createIndexParams: CreateIndexParams = {  
      indexName: indexName,  
      dimension: 3,  
      metric: 'cosine',  
    };  
    await mongoVector.createIndex(createIndexParams);  
    console.log(`Index "${indexName}" created`);  
  
    // Wait for index to be ready  
    console.log(`Waiting for index "${indexName}" to be ready...`);  
    await mongoVector.waitForIndexReady(indexName);  
    console.log(`Index "${indexName}" is ready`);  
  
    // Upsert Vectors  
    const vectorsToUpsert: MongoDBUpsertVectorParams = {  
      indexName: indexName,  
      vectors: [  
        [0.1, 0.2, 0.3],  
        [0.4, 0.5, 0.6],  
        [0.7, 0.8, 0.9],  
      ],  
      metadata: [  
        { id: 'vec1', type: 'example' },  
        { id: 'vec2', type: 'sample' },  
        { id: 'vec3', type: 'test' },  
      ],  
      ids: ['id1', 'id2', 'id3'],  
      documents: ['doc1 content', 'doc2 content', 'doc3 content'],  
    };  
    const upsertedIds = await mongoVector.upsert(vectorsToUpsert);  
    console.log('Upserted IDs:', upsertedIds);  
  
    // Wait for data to be indexed  
    console.log('Waiting for data to be indexed...');  
    await new Promise((resolve) => setTimeout(resolve, 10000)); // wait for 10 seconds  
  
    // Query Vector  
    const queryVectorParams: MongoDBQueryVectorParams = {  
      indexName: indexName,  
      queryVector: [0.15, 0.25, 0.35],  
      topK: 2,  
      includeVector: true,  
      // filter: { type: 'example' },  
    };  
    const queryResults = await mongoVector.query(queryVectorParams);  
    console.log('Query Results:', queryResults);  
  
    // List Indexes  
    const indexes = await mongoVector.listIndexes();  
    console.log('List of Indexes:', indexes);  
  
    // Describe Index  
    const indexStats = await mongoVector.describeIndex(indexName);  
    console.log('Index Stats:', indexStats);  
  
    // Update Index By Id  
    await mongoVector.updateIndexById(indexName, 'id2', { metadata: { updated: true } });  
    console.log('Updated index by ID "id2"');  
  
    // Wait for data to be indexed  
    console.log('Waiting for data to be re-indexed...');  
    await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds  
  
    // Query again after update  
    const queryResultsAfterUpdate = await mongoVector.query(queryVectorParams);  
    console.log('Query Results After Update:', queryResultsAfterUpdate);  
  
    // Delete Index By Id  
    await mongoVector.deleteIndexById(indexName, 'id3');  
    console.log('Deleted index by ID "id3"');  
  
    // Wait for data to be updated  
    console.log('Waiting for data to reflect deletion...');  
    await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds  
  
    // Query after delete by id  
    const queryResultsAfterDelete = await mongoVector.query({ ...queryVectorParams, topK: 3 });  
    console.log('Query Results After Delete by ID:', queryResultsAfterDelete);  
  
    // Delete Index  
    // await mongoVector.deleteIndex(indexName);  
    // console.log(`Index "${indexName}" deleted`);  
  } catch (error) {  
    console.error('Error during demo:', error);  
  } finally {  
    await mongoVector.close();  
    console.log('Disconnected from MongoDB');  
  }  
}  
  
// Run the main function  
main().catch((error) => {  
  console.error('Error in main:', error);  
});  