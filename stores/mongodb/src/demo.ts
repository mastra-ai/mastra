import { MastraStorage } from '@mastra/core/storage';  
import { MongoClient, Collection, Db } from 'mongodb';  
  
// --------------------------------------------------------------------  
// MongoDB Configuration Type  
// --------------------------------------------------------------------  
type MongoDBConfig =  
  | {  
      host: string;  
      port: number;  
      database: string;  
      user?: string;  
      password?: string;  
      authSource?: string;  
      ssl?: boolean;  
    }  
  | {  
      connectionString: string;  
    };  
  
// --------------------------------------------------------------------  
// MongoDBStore Class  
// --------------------------------------------------------------------  
class MongoDBStore extends MastraStorage {  
  private client: MongoClient;  
  private db: Db | undefined;  
  private config: MongoDBConfig;  
  private schemas: Record<string, any> = {};  
  
  constructor(config: MongoDBConfig) {  
    super({ name: 'MongoDBStore' });  
  
    this.config = config;  
  
    let uri: string;  
    if ('connectionString' in config) {  
      uri = config.connectionString;  
    } else {  
      let authPart = '';  
      if (config.user && config.password) {  
        authPart = `${config.user}:${config.password}@`;  
      }  
      uri = `mongodb://${authPart}${config.host}:${config.port}/${config.database}${  
        config.authSource ? `?authSource=${config.authSource}` : ''  
      }${config.ssl ? '&ssl=true' : ''}`;  
    }  
  
    this.client = new MongoClient(uri);  
  }  
  
  async connect(): Promise<void> {  
    try {  
      await this.client.connect();  
      this.db = this.client.db(this.getDatabaseName());  
      console.log('MongoDBStore connected successfully.');  
    } catch (error) {  
      console.error('Error connecting to MongoDB:', error);  
      throw error;  
    }  
  }  
  
  async disconnect(): Promise<void> {  
    try {  
      await this.client.close();  
      this.db = undefined;  
      console.log('MongoDBStore disconnected successfully.');  
    } catch (error) {  
      console.error('Error disconnecting from MongoDB:', error);  
      throw error;  
    }  
  }  
  
  private getCollection(tableName: string): Collection {  
    if (!this.db) {  
      throw new Error('MongoDBStore is not connected. Call connect() first.');  
    }  
    return this.db.collection(tableName);  
  }  
  
  private getDatabaseName(): string {  
    if ('database' in this.config) {  
      return this.config.database;  
    }  
    // Extract database name from connection string if not provided  
    const uri = this.config.connectionString;  
    const dbNameMatch = uri.match(/\/([a-zA-Z0-9_-]+)(\?|$)/);  
    if (dbNameMatch) {  
      return dbNameMatch[1];  
    }  
    return 'test_db'; // Default fallback  
  }  
  
  async createTable({  
    tableName,  
    schema,  
  }: {  
    tableName: string;  
    schema: Record<string, any>;  
  }): Promise<void> {  
    try {  
      const db = this.client.db(this.getDatabaseName());  
      const collectionNames = await db.listCollections().toArray();  
  
      if (!collectionNames.some((c) => c.name === tableName)) {  
        await db.createCollection(tableName);  
        this.schemas[tableName] = schema;  
        console.log(`Table (Collection) '${tableName}' created successfully.`);  
      } else {  
        console.log(`Table (Collection) '${tableName}' already exists.`);  
        this.schemas[tableName] = schema;  
      }  
    } catch (error) {  
      console.error(`Error creating table (collection) '${tableName}':`, error);  
      throw error;  
    }  
  }  
  
  async clearTable({ tableName }: { tableName: string }): Promise<void> {  
    try {  
      const collection = this.getCollection(tableName);  
      await collection.deleteMany({});  
      console.log(`Table (Collection) '${tableName}' cleared.`);  
    } catch (error) {  
      console.error(`Error clearing table (collection) '${tableName}':`, error);  
      throw error;  
    }  
  }  
  
  async insert({  
    tableName,  
    record,  
  }: {  
    tableName: string;  
    record: any;  
  }): Promise<void> {  
    try {  
      const collection = this.getCollection(tableName);  
      await collection.insertOne(record);  
      console.log(`Record inserted into '${tableName}'.`);  
    } catch (error) {  
      console.error(`Error inserting into '${tableName}':`, error);  
      throw error;  
    }  
  }  
  
  async batchInsert({  
    tableName,  
    records,  
  }: {  
    tableName: string;  
    records: any[];  
  }): Promise<void> {  
    try {  
      const collection = this.getCollection(tableName);  
      await collection.insertMany(records);  
      console.log(`Batch insert into '${tableName}' completed.`);  
    } catch (error) {  
      console.error(`Error during batch insert into '${tableName}':`, error);  
      throw error;  
    }  
  }  
  
  async load<R>({  
    tableName,  
    keys,  
  }: {  
    tableName: string;  
    keys: Record<string, string>;  
  }): Promise<R | null> {  
    try {  
      const collection = this.getCollection(tableName);  
      const filter: any = {};  
      for (const key in keys) {  
        if (Object.prototype.hasOwnProperty.call(keys, key)) {  
          filter[key] = keys[key];  
        }  
      }  
      const result = await collection.findOne(filter);  
      if (result) {  
        return result as R;  
      }  
      return null;  
    } catch (error) {  
      console.error(`Error loading from '${tableName}':`, error);  
      throw error;  
    }  
  }  
  
  // ... [Other methods like getThreadById, getThreadsByResourceId, etc.] ...  
  
  async close(): Promise<void> {  
    try {  
      if (this.client) {  
        await this.client.close();  
        this.db = undefined;  
        console.log('MongoDBStore connection closed.');  
      }  
    } catch (error) {  
      console.error('Error closing MongoDBStore connection:', error);  
    }  
  }  
}  
  
// --------------------------------------------------------------------  
// Utility Function  
// --------------------------------------------------------------------  
  
// Utility function to pause execution for given milliseconds  
function sleep(ms: number): Promise<void> {  
  return new Promise((resolve) => setTimeout(resolve, ms));  
}  
  
// --------------------------------------------------------------------  
// Document Interface  
// --------------------------------------------------------------------  
  
// Define the structure of your document  
interface MyDocument {  
  name: string;  
  value: number;  
  embedding: number[]; // Hardcoded embedding vector  
}  
  
// --------------------------------------------------------------------  
// Demo Function  
// --------------------------------------------------------------------  
async function demo() {  
  const config: MongoDBConfig = {  
    connectionString:  
      'mongodb://0.0.0.0:27017/?directConnection=true&serverSelectionTimeoutMS=2000', // Replace with your MongoDB URI  
  };  
  const store = new MongoDBStore(config);  
  
  const collectionName = 'myCollection';  
  const indexName = 'myVectorSearchIndex';  
  const embeddingField = 'embedding';  
  
  try {  
    // Connect to MongoDB  
    await store.connect();  
    console.log('Connected to MongoDB');  
  
    const db: Db = (store as any).client.db((store as any).getDatabaseName());  
  
    // Create Collection/Table  
    await store.createTable({  
      tableName: collectionName,  
      schema: { name: 'string', value: 'number', embedding: 'number[]' },  
    });  
  
    // ----------------------------------------------------------------  
    // Function to List Search Indexes  
    // ----------------------------------------------------------------  
    async function listSearchIndexes(db: Db, collectionName: string): Promise<void> {  
      try {  
        const collection: Collection = db.collection(collectionName);  
        const indexes = await collection.listIndexes().toArray();  
        console.log(`Search indexes in '${collectionName}':`);  
        indexes.forEach((index) => {  
          // Identify if it's a vector search index based on name or key  
          if (  
            index.key &&  
            typeof index.key[embeddingField] === 'string' &&  
            index.key[embeddingField].toLowerCase().includes('vector')  
          ) {  
            console.log(JSON.stringify(index, null, 2));  
          }  
        });  
      } catch (error) {  
        console.error(`Error listing search indexes for '${collectionName}':`, error);  
        throw error;  
      }  
    }  
  
    // ----------------------------------------------------------------  
    // Insert a Document with Hardcoded Embedding  
    // ----------------------------------------------------------------  
    const hardcodedEmbedding: number[] = Array(128).fill(0.5); // Example embedding vector  
    const newDocument: MyDocument = {  
      name: 'Sample Document',  
      value: 42,  
      embedding: hardcodedEmbedding,  
    };  
  
    await store.insert({  
      tableName: collectionName,  
      record: newDocument,  
    });  
  
    console.log('Inserted a document with hardcoded embedding.');  
  
    // ----------------------------------------------------------------  
    // Wait for the Document to be Indexed (if necessary)  
    // ----------------------------------------------------------------  
    console.log('Waiting for the document to be indexed...');  
    await sleep(5000); // Wait for 5 seconds  
  
    // ----------------------------------------------------------------  
    // Perform a Basic Vector Search  
    // ----------------------------------------------------------------  
    async function performVectorSearch(  
      db: Db,  
      collectionName: string,  
      embeddingField: string,  
      queryEmbedding: number[],  
      limit: number = 5  
    ): Promise<void> {  
      try {  
        const collection: Collection = db.collection(collectionName);  
  
        // Define the vector search aggregation stage using Atlas Search's knn operator  
        const vectorSearchStage = {  
          $search: {  
            knn: {  
              vector: queryEmbedding,  
              path: embeddingField,  
              k: limit,  
            },  
          },  
        };  
  
        // Define the pipeline  
        const pipeline = [vectorSearchStage];  
  
        // Execute the aggregation  
        const results = await collection.aggregate(pipeline).toArray();  
  
        console.log('Vector Search Results:', results);  
      } catch (error) {  
        console.error('Error performing vector search:', error);  
        throw error;  
      }  
    }  
  
    // Define a query embedding (same as inserted for demonstration)  
    const queryEmbedding: number[] = Array(128).fill(0.5); // Replace with your actual query embedding  
  
    // Perform Vector Search  
    //await performVectorSearch(db, collectionName, embeddingField, queryEmbedding, 5);  
    console.log('Performing vector search...');
    console.log('Coming Soon...');
  } catch (err) {  
    console.error('Error:', err);  
  } finally {  
    await store.disconnect();  
    console.log('Connection closed');  
  }  
}  
  
// --------------------------------------------------------------------  
// Execute the Demo  
// --------------------------------------------------------------------  
demo();  