import { MastraStorage } from '@mastra/core/storage';
import { MongoClient, Collection, Db } from 'mongodb';


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

class MongoDBStore extends MastraStorage {
  private client: MongoClient;
  private db: Db | undefined;
  private config: MongoDBConfig; // Declare config as a class property
  private schemas: Record<string, any> = {};

  constructor(config: MongoDBConfig) {
    super({ name: 'MongoDBStore' });

    this.config = config; // Initialize config in the constructor

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
      }${config.ssl ? '?ssl=true' : ''}`;
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
    if ('connectionString' in this.config) {
      const match = this.config.connectionString.match(/\/([^/?]+)/);
      return match && match[1] ? match[1] : 'defaultdb';
    } else {
      return this.config.database;
    }
  }

  async createTable({ tableName, schema }: { tableName: string; schema: Record<string, any> }): Promise<void> {
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

  async insert({ tableName, record }: { tableName: string; record: any }): Promise<void> {
    try {
      const collection = this.getCollection(tableName);
      await collection.insertOne(record);
      console.log(`Record inserted into '${tableName}'.`);
    } catch (error) {
      console.error(`Error inserting into '${tableName}':`, error);
      throw error;
    }
  }

  async batchInsert({ tableName, records }: { tableName: string; records: any[] }): Promise<void> {
    try {
      const collection = this.getCollection(tableName);
      await collection.insertMany(records);
      console.log(`Batch insert into '${tableName}' completed.`);
    } catch (error) {
      console.error(`Error during batch insert into '${tableName}':`, error);
      throw error;
    }
  }

  async load<R>({ tableName, keys }: { tableName: string; keys: Record<string, string> }): Promise<R | null> {
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

  async getThreadById({ threadId }: { threadId: string }): Promise<any | null> {
    try {
      const collection = this.getCollection('threads');
      const result = await collection.findOne({ id: threadId });
      if (result) {
        return result;
      }
      return null;
    } catch (error) {
      console.error(`Error getting thread by ID '${threadId}':`, error);
      throw error;
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<any[]> {
    try {
      const collection = this.getCollection('threads');
      const results = await collection.find({ resourceId: resourceId }).toArray();
      return results;
    } catch (error) {
      console.error(`Error getting threads by resource ID '${resourceId}':`, error);
      throw error;
    }
  }

  async saveThread({ thread }: { thread: any }): Promise<any> {
    try {
      const collection = this.getCollection('threads');
      await collection.updateOne({ id: thread.id }, { $set: thread }, { upsert: true });
      return thread;
    } catch (error) {
      console.error(`Error saving thread:`, error);
      throw error;
    }
  }

  async updateThread({ id, title, metadata }: { id: string; title: string; metadata: Record<string, unknown> }): Promise<any> {
    try {
      const collection = this.getCollection('threads');
      await collection.updateOne({ id: id }, { $set: { title: title, metadata: metadata, updatedAt: new Date() } });
      const updatedThread = await collection.findOne({ id: id });
      return updatedThread;
    } catch (error) {
      console.error(`Error updating thread with ID '${id}':`, error);
      throw error;
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      await this.db?.collection('messages').deleteMany({ thread_id: threadId });
      const collection = this.getCollection('threads');
      await collection.deleteOne({ id: threadId });
      console.log(`Thread with ID '${threadId}' deleted.`);
    } catch (error) {
      console.error(`Error deleting thread and messages with ID '${threadId}':`, error);
      throw error;
    }
  }

  async getMessages({ threadId, selectBy }: { threadId: string; selectBy?: any }): Promise<any[]> {
    try {
      const collection = this.getCollection('messages');
      let query: any = { threadId: threadId };
      let options: any = {};

      if (selectBy?.last) {
        options.sort = { createdAt: -1 };
        options.limit = selectBy.last;
      }

      const results = await collection.find(query, options).toArray();
      return results;
    } catch (error) {
      console.error(`Error getting messages for thread '${threadId}':`, error);
      throw error;
    }
  }

  async saveMessages({ messages }: { messages: any[] }): Promise<any[]> {
    try {
      const collection = this.getCollection('messages');
      await collection.insertMany(messages);
      return messages;
    } catch (error) {
      console.error(`Error saving messages:`, error);
      throw error;
    }
  }

  async getTraces({ name, scope, page, perPage, attributes, filters }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
  }): Promise<any[]> {
    try {
      const collection = this.getCollection('traces');
      let query: any = {};
      let options: any = {
        sort: { createdAt: -1 },
        skip: page * perPage,
        limit: perPage,
      };

      if (name) query.name = { $regex: name, $options: 'i' };
      if (scope) query.scope = scope;
      if (attributes) query['attributes.key'] = { $in: Object.keys(attributes) };
      if (filters) query = { ...query, ...filters };

      const results = await collection.find(query, options).toArray();
      return results;
    } catch (error) {
      console.error(`Error getting traces:`, error);
      return [];
    }
  }

  async getEvalsByAgentName(agentName: string, type?: string): Promise<any[]> {
    try {
      const collection = this.getCollection('evals');
      let query: any = { agentName: agentName };
      if (type) {
        if (type === 'test') {
          query['testInfo.testPath'] = { $ne: null };
        } else if (type === 'live') {
          query['testInfo.testPath'] = null;
        }
      }
      const results = await collection.find(query).sort({ createdAt: -1 }).toArray();
      return results;
    } catch (error) {
      console.error(`Error getting evals by agent name:`, error);
      return [];
    }
  }

  async getWorkflowRuns(args: any = {}): Promise<any> {
    try {
      const collection = this.getCollection('workflow_snapshots');
      let query: any = {};
      let options: any = {
        sort: { createdAt: -1 },
      };

      if (args.workflowName) query.workflowName = args.workflowName;
      if (args.fromDate) query.createdAt = { $gte: args.fromDate };
      if (args.toDate) query.createdAt = { ...query.createdAt, $lte: args.toDate };

      if (args.limit !== undefined && args.offset !== undefined) {
        options.skip = args.offset;
        options.limit = args.limit;
      }

      const runs = await collection.find(query, options).toArray();
      const total = await collection.countDocuments(query);

      return { runs, total };
    } catch (error) {
      console.error(`Error getting workflow runs:`, error);
      return [];
    }
  }

  async persistWorkflowSnapshot({ workflowName, runId, snapshot }: { workflowName: string; runId: string; snapshot: any }): Promise<void> {
    try {
      const collection = this.getCollection('workflow_snapshots');
      await collection.updateOne(
        { workflowName: workflowName, runId: runId },
        { $set: { snapshot: snapshot, updatedAt: new Date(), createdAt: new Date() } },
        { upsert: true },
      );
      console.log(`Workflow snapshot persisted for ${workflowName} - ${runId}.`);
    } catch (error) {
      console.error(`Error persisting workflow snapshot:`, error);
    }
  }

  async loadWorkflowSnapshot({ workflowName, runId }: { workflowName: string; runId: string }): Promise<any | null> {
    try {
      const collection = this.getCollection('workflow_snapshots');
      const result = await collection.findOne({ workflowName: workflowName, runId: runId });
      if (result) {
        return result;
      }
      return null;
    } catch (error) {
      console.error(`Error loading workflow snapshot:`, error);
      return null;
    }
  }

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




async function demo() {
  const config:any = {
    connectionString: 'mongodb://localhost:27017/?directConnection=true&serverSelectionTimeoutMS=2000', // Replace with your MongoDB URI
  };
  const store = new MongoDBStore(config);

  const collectionName = 'myCollection';
  const indexName = 'myVectorSearchIndex';
  const embeddingField = 'embedding';

  try {
    await store.connect();
    console.log('Connected to MongoDB');

    const db: Db = (store as any).client.db((store as any).getDatabaseName());

    await store.createTable({ tableName: collectionName, schema: { name: 'string', value: 'number' } });

    async function createSearchIndex(
      db: Db,
      collectionName: string,
      indexName: string,
      embeddingField: string,
    ): Promise<void> {
      try {
        const collection: Collection = db.collection(collectionName);

        const existingIndexes = await collection.listSearchIndexes().toArray();
        if (existingIndexes.some((idx) => idx.name === indexName)) {
          console.log(`Search index '${indexName}' already exists.`);
          return;
        }

        const numDimensions = 128; // Example: Replace with your embedding dimension

        const searchIndexModel = ({
          definition: {
            mappings: {
              dynamic: false,
              fields: {
                [embeddingField]: {
                  type: 'knnVector',
                  dimensions: numDimensions,
                  similarity: 'cosine',
                },
              },
            },
          },
          name: indexName,
        });

        await collection.createSearchIndex(searchIndexModel);
        console.log(`Search index '${indexName}' created successfully.`);
      } catch (error) {
        console.error(`Error creating search index '${indexName}':`, error);
        throw error;
      }
}

demo();