// latest working demo
/**    
 * demo.ts    
 * This demo showcases how to use MongoDBVector and MongoFilterTranslator together.    
 */    
  
// Import necessary modules    
import { MongoClient, Db, Collection } from 'mongodb';    
import type { MongoClientOptions, Document } from 'mongodb';    
import { BaseFilterTranslator } from '@mastra/core/vector/filter';  
import type { FieldCondition, VectorFilter, OperatorSupport, QueryOperator } from '@mastra/core/vector/filter';  
import { v4 as uuidv4 } from 'uuid';    
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
  
// MongoFilterTranslator implementation    
class MongoFilterTranslator extends BaseFilterTranslator {    
  translate(filter: VectorFilter): any {    
    if (!filter) {    
      return {};    
    }    
    this.validateFilter(filter); // Validate the filter structure    
    return this.processFilter(filter);    
  }    

  private translateNode(node: VectorFilter | FieldCondition, currentPath: string = ''): any {
    if (this.isRegex(node)) {
      throw new Error('Regex is not supported in MongoDB. TODO: Implement regex support');
    }
    if (this.isPrimitive(node)) return this.normalizeComparisonValue(node);
    if (Array.isArray(node)) return { $in: this.normalizeArrayValues(node) };

    const entries = Object.entries(node as Record<string, any>);
    const firstEntry = entries[0];

    // Handle single operator case
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      const translated = this.translateOperator(operator, value, currentPath);
      return this.isLogicalOperator(operator) ? { [operator]: translated } : translated;
    }

    // Process each entry
    const result: Record<string, any> = {};

    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        result[key] = this.translateOperator(key, value, currentPath);
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested $all
        if (Object.keys(value).length === 1 && '$all' in value) {
          const translated = this.translateNode(value, key);
          if (translated.$and) {
            return translated;
          }
        }

        // Check if the nested object contains operators
        if (Object.keys(value).length === 0) {
          result[newPath] = this.translateNode(value);
        } else {
          const hasOperators = Object.keys(value).some(k => this.isOperator(k));
          if (hasOperators) {
            // For objects with operators, normalize each operator value
            const normalizedValue: Record<string, any> = {};
            for (const [op, opValue] of Object.entries(value)) {
              normalizedValue[op] = this.isOperator(op) ? this.translateOperator(op, opValue) : opValue;
            }
            result[newPath] = normalizedValue;
          } else {
            // For objects without operators, flatten them
            Object.assign(result, this.translateNode(value, newPath));
          }
        }
      } else {
        result[newPath] = this.translateNode(value);
      }
    }

    return result;
  }
  private translateOperator(operator: QueryOperator, value: any, currentPath: string = ''): any {
    // Handle $all specially
    if (operator === '$all') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('A non-empty array is required for the $all operator');
      }

      return this.simulateAllOperator(currentPath, value);
    }

    // Handle logical operators
    if (this.isLogicalOperator(operator)) {
      return Array.isArray(value) ? value.map(item => this.translateNode(item)) : this.translateNode(value);
    }

    // Handle comparison and element operators
    return this.normalizeComparisonValue(value);
  }
  private processFilter(filter: VectorFilter): any {    
    const mongoFilter: any = {};    
    
    for (const key in filter) {    
      if (!Object.prototype.hasOwnProperty.call(filter, key)) continue;    
    
      const value = filter[key];    
    
      if (this.isLogicalOperator(key)) {    
        // Handle logical operators like $and, $or, $nor    
        if (!Array.isArray(value)) {    
          throw new Error(    
            `Value for logical operator ${key} must be an array`    
          );    
        }    
        mongoFilter[key] = value.map((subFilter: any) =>    
          this.processFilter(subFilter)    
        );    
      } else if (this.isOperator(key)) {    
        // Operators like $eq, $gt should not be at the top level    
        throw new Error(    
          `Invalid operator at top level: ${key}. Operators should be within field conditions.`    
        );    
      } else {    
        // Key is a field name    
        mongoFilter[key] = this.processFieldCondition(value);    
      }    
    }    
    
    return mongoFilter;    
  }    
    
  private processFieldCondition(condition: FieldCondition): any {    
    if (condition === null || condition === undefined) {    
      throw new Error('Field condition cannot be null or undefined');    
    } else if (this.isPrimitive(condition) || this.isRegex(condition)) {    
      // Primitive value or regex, treat as equality    
      return condition;    
    } else if (Array.isArray(condition)) {    
      // For arrays, treat as $in operator    
      return { $in: condition };    
    } else if (typeof condition === 'object') {    
      // Operator conditions    
      const fieldQuery: any = {};    
    
      for (const op in condition) {    
        if (!Object.prototype.hasOwnProperty.call(condition, op)) continue;    
    
        const opValue = (condition as any)[op];    
    
        if (this.isOperator(op)) {    
          if (this.isLogicalOperator(op)) {    
            if (op === '$not') {    
              // Handle $not operator within field condition    
              if (typeof opValue !== 'object') {    
                throw new Error('$not operator requires an object');    
              }    
              fieldQuery[op] = this.processFieldCondition(    
                opValue as FieldCondition    
              );    
            } else {    
              // Other logical operators are invalid within field conditions    
              throw new Error(    
                `Logical operator ${op} cannot be used within field conditions`    
              );    
            }    
          } else if (    
            this.isBasicOperator(op) ||    
            this.isNumericOperator(op) ||    
            this.isArrayOperator(op) ||    
            this.isElementOperator(op) ||    
            this.isRegexOperator(op)    
          ) {    
            if (op === '$regex') {    
              // Handle $regex operator    
              if (typeof opValue !== 'string' && !this.isRegex(opValue)) {    
                throw new Error('$regex value must be a string or RegExp');    
              }    
              fieldQuery[op] = opValue;    
              // Handle $options if present    
              if ('$options' in (condition as any)) {    
                const optionsValue = (condition as any)['$options'];    
                if (typeof optionsValue !== 'string') {    
                  throw new Error('$options value must be a string');    
                }    
                fieldQuery['$options'] = optionsValue;    
              }    
            } else if (op === '$options') {    
              // Already handled with $regex    
              continue;    
            } else if (op === '$elemMatch') {    
              // Handle $elemMatch operator    
              if (typeof opValue !== 'object') {    
                throw new Error('$elemMatch operator requires an object');    
              }    
              fieldQuery[op] = this.processFilter(    
                opValue as VectorFilter    
              );    
            } else if (op === '$all') {    
              // $all expects an array    
              if (!Array.isArray(opValue)) {    
                throw new Error('$all operator requires an array value');    
              }    
              fieldQuery[op] = opValue;    
            } else if (op === '$exists') {    
              // $exists requires a boolean value    
              if (typeof opValue !== 'boolean') {    
                throw new Error('$exists operator requires a boolean value');    
              }    
              fieldQuery[op] = opValue;    
            } else {    
              // Other operators like $eq, $ne, $gt, etc.    
              fieldQuery[op] = opValue;    
            }    
          } else {    
            throw new Error(`Unsupported operator: ${op}`);    
          }    
        } else {    
          // Nested field condition (e.g., embedded documents)    
          fieldQuery[op] = this.processFieldCondition(    
            opValue as FieldCondition    
          );    
        }    
      }    
      return fieldQuery;    
    } else {    
      throw new Error(    
        `Unsupported field condition type: ${typeof condition}`    
      );    
    }    
  }    
    
  // Override methods from BaseFilterTranslator as needed    
  protected getSupportedOperators(): OperatorSupport {    
    // Return MongoDB supported operators    
    return {    
      logical: BaseFilterTranslator.DEFAULT_OPERATORS.logical,    
      basic: BaseFilterTranslator.DEFAULT_OPERATORS.basic,    
      numeric: BaseFilterTranslator.DEFAULT_OPERATORS.numeric,    
      array: BaseFilterTranslator.DEFAULT_OPERATORS.array,    
      element: BaseFilterTranslator.DEFAULT_OPERATORS.element,    
      regex: BaseFilterTranslator.DEFAULT_OPERATORS.regex,    
      custom: [],    
    };    
  }    
}    
  
// The MongoDBVector class    
class MongoDBVector {    
  // Private member variables  
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
  
  constructor({    
    uri,    
    dbName,    
    options,    
  }: {    
    uri: string;    
    dbName: string;    
    options?: MongoClientOptions;    
  }) {    
    this.client = new MongoClient(uri, options);    
    this.db = this.client.db(dbName);    
    this.collections = new Map();    
  }    
    
  // Public methods  
  async connect(): Promise<void> {    
    await this.client.connect();    
  }    
    
  async close(): Promise<void> {    
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
        "definition": {  
          "fields": [  
            {  
              "type": "vector",  
              "path": embeddingField,  
              "numDimensions": numDimensions,  
              "similarity": mongoMetric  
            }  
          ]  
        },  
        "name": indexNameInternal,  
        "type": "vectorSearch"  
      });    
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
  
  async waitForIndexReady(    
    indexName: string,    
    timeoutMs: number = 60000,    
    checkIntervalMs: number = 2000,    
  ): Promise<void> {    
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
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));    
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
  
  async query(params: MongoDBQueryVectorParams): Promise<QueryResult[]> {    
    const { indexName, queryVector, topK = 10, filter, includeVector = false, documentFilter } = params;    
    
    const collection = await this.getCollection(indexName, true);    
    const indexNameInternal = `${indexName}_vector_index`;    
    
    // Transform the filters using MongoFilterTranslator    
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
        throw new Error(    
          `Vector at index ${i} has invalid dimension ${v}. Expected ${dimension} dimensions.`,    
        );    
      }    
    }    
  }    
    
  private async setIndexDimension(dimension: number): Promise<void> {    
    // Store the dimension in a special metadata document    
    const collection = this.collectionForValidation!; // 'collectionForValidation' is set in 'upsert' method    
    await collection.updateOne({ _id: '__index_metadata__' }, { $set: { dimension } }, { upsert: true });    
  }    
  
  private transformFilter(filter?: VectorFilter): any {    
    const translator = new MongoFilterTranslator();    
    if (!filter) return {};  
    return translator.translate(filter);    
  }    
}    
  
// Implement a mock getEmbedding function    
function getEmbedding(text: string): number[] {    
  // For the purpose of this demo, generate a fixed-length random vector    
  // In a real-world scenario, you would call an embedding service like OpenAI embeddings    
  const dimension = 128; // Assuming embeddings are 128-dimensional    
  return Array.from({ length: dimension }, () => Math.random());    
}    
  
async function main() {    
  const uri = 'mongodb://localhost:27017/?directConnection=true&serverSelectionTimeoutMS=2000'; // Replace with your MongoDB connection string    
  const dbName = 'vector_db';    
  const indexName = 'my_vectors';    
  const dimension = 128;    
    
  const options: MongoClientOptions = {};    
    
  // Instantiate the MongoDBVector class    
  const vectorStore = new MongoDBVector({    
    uri,    
    dbName,    
    options,    
  });    
    
  try {    
    // Connect to MongoDB    
    await vectorStore.connect();    
    console.log('Connected to MongoDB');    
    
    // Create an index    
    await vectorStore.createIndex({ indexName, dimension, metric: 'cosine' });    
    console.log(`Index '${indexName}' created`);    
    
    // Wait for index to be ready    
    await vectorStore.waitForIndexReady(indexName);    
    console.log(`Index '${indexName}' is ready`);    
    
    // Prepare sample documents    
    const documents = [    
      { _id: 'doc1', content: 'This is the first document.', metadata: { category: 'A' } },    
      { _id: 'doc2', content: 'Second document goes here.', metadata: { category: 'B' } },    
      { _id: 'doc3', content: 'Another document for testing.', metadata: { category: 'A' } },    
    ];    
    
    // Prepare arrays for upsert    
    const vectors: number[][] = [];    
    const metadatas: Record<string, any>[] = [];    
    const documentTexts: string[] = [];    
    const ids: string[] = [];    
    
    // Generate embeddings and collect data    
    for (const doc of documents) {    
      const embedding = getEmbedding(doc.content);    
      vectors.push(embedding);    
      metadatas.push(doc.metadata);    
      documentTexts.push(doc.content);    
      ids.push(doc._id);    
    }    
    
    // Upsert the vectors and documents    
    await vectorStore.upsert({    
      indexName,    
      vectors,    
      metadata: metadatas,    
      documents: documentTexts,    
      ids,    
    });    
    console.log('Documents inserted with embeddings');    
    
    // Prepare query vector    
    const queryText = 'Find similar documents.';    
    const queryEmbedding = getEmbedding(queryText);    
    
    // Define a filter (VectorFilter)    
    const vectorFilter: VectorFilter = {    
      'metadata.category': { $eq: 'A' },    
    };    
    
    // Perform a vector search with filter    
    const results = await vectorStore.query({    
      indexName,    
      queryVector: queryEmbedding,    
      topK: 5,    
      filter: vectorFilter,    
      includeVector: false,    
    });    
    
    console.log('Search Results:');    
    console.log(JSON.stringify(results, null, 2));    


    // TESTS
    // Instantiate the MongoFilterTranslator  
    const translator = new MongoFilterTranslator();  
  
    // Define test cases for basic filter translation  
    const testCases = [  
        {  
        description: 'Translate equality filter',  
        input: { 'metadata.category': { $eq: 'A' } },  
        expectedOutput: { 'metadata.category': { $eq: 'A' } },  
        },  
        {  
        description: 'Translate $in operator',  
        input: { 'metadata.tags': { $in: ['tag1', 'tag2'] } },  
        expectedOutput: { 'metadata.tags': { $in: ['tag1', 'tag2'] } },  
        },  
        {  
        description: 'Translate $gt operator',  
        input: { 'metadata.value': { $gt: 10 } },  
        expectedOutput: { 'metadata.value': { $gt: 10 } },  
        },  
        {  
        description: 'Translate $exists operator',  
        input: { 'metadata.optionalField': { $exists: true } },  
        expectedOutput: { 'metadata.optionalField': { $exists: true } },  
        },  
        {  
        description: 'Translate logical $and operator',  
        input: { $and: [{ 'metadata.category': { $eq: 'A' } }, { 'metadata.value': { $gt: 10 } }] },  
        expectedOutput: { $and: [{ 'metadata.category': { $eq: 'A' } }, { 'metadata.value': { $gt: 10 } }] },  
        },  
    ];  
  
    // Run each test case  
    testCases.forEach(({ description, input, expectedOutput }) => {  
        try {  
        const result = translator.translate(input);  
        const isSuccess = JSON.stringify(result) === JSON.stringify(expectedOutput);  
        console.log(`${description}: ${isSuccess ? 'Passed' : 'Failed'}`);  
        if (!isSuccess) {  
            console.log(`  Expected: ${JSON.stringify(expectedOutput)}`);  
            console.log(`  Received: ${JSON.stringify(result)}`);  
        }  
        } catch (error) {  
        console.error(`${description}: Failed with error`, error);  
        }  
    });  

    
  } catch (error) {    
    console.error('An error occurred:', error);    
  } finally {    
    // Close the connection    
    await vectorStore.close();    
    console.log('Connection closed');    
  }    
}    
  
main().catch(console.error);    

/*
Connected to MongoDB
Index 'my_vectors' created
Index 'my_vectors' is ready
Documents inserted with embeddings
Search Results:
[
  {
    "id": "doc3",
    "score": 0.8979873657226562,
    "metadata": {
      "category": "A"
    },
    "document": "Another document for testing."
  },
  {
    "id": "doc1",
    "score": 0.8872531652450562,
    "metadata": {
      "category": "A"
    },
    "document": "This is the first document."
  }
]
Translate equality filter: Passed
Translate $in operator: Passed
Translate $gt operator: Passed
Translate $exists operator: Passed
Translate logical $and operator: Passed
Connection closed
*/
