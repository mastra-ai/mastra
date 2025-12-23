import {
  createTestSuite,
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
  createStoreIndexTests,
  createDomainIndexTests,
} from '@internal/storage-test-utils';
import { SpanType } from '@mastra/core/observability';
import { TABLE_THREADS } from '@mastra/core/storage';
import { MongoClient } from 'mongodb';
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import type { ConnectorHandler } from './connectors/base';
import { MemoryStorageMongoDB } from './domains/memory';
import { ScoresStorageMongoDB } from './domains/scores';
import { WorkflowsStorageMongoDB } from './domains/workflows';
import type { MongoDBConfig } from './types';
import { MongoDBStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_CONFIG: MongoDBConfig = {
  id: 'mongodb-test-store',
  url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-test-db',
};

// Helper to create a connectorHandler from MongoClient
const createConnectorHandler = async (): Promise<{ handler: ConnectorHandler; client: MongoClient }> => {
  const client = new MongoClient(TEST_CONFIG.url!);
  await client.connect();
  const db = client.db(TEST_CONFIG.dbName);

  return {
    handler: {
      getCollection: async (name: string) => db.collection(name),
      close: async () => client.close(),
    },
    client,
  };
};

// Mock connectorHandler for config validation tests (doesn't need real connection)
const createMockConnectorHandler = (): ConnectorHandler => {
  const mockCollection = {} as ReturnType<ReturnType<MongoClient['db']>['collection']>;
  return {
    getCollection: async () => mockCollection,
    close: async () => {},
  };
};

// Run the shared test suite
createTestSuite(new MongoDBStore(TEST_CONFIG));

// Configuration validation tests
createConfigValidationTests({
  storeName: 'MongoDBStore',
  createStore: config => new MongoDBStore(config as any),
  validConfigs: [
    {
      description: 'URL/dbName config',
      config: { id: 'test-store', url: 'mongodb://localhost:27017', dbName: 'test-db' },
    },
    {
      description: 'URL/dbName with options',
      config: {
        id: 'test-store',
        url: 'mongodb://localhost:27017',
        dbName: 'test-db',
        options: { maxPoolSize: 50, minPoolSize: 5 },
      },
    },
    {
      description: 'connectorHandler',
      config: { id: 'test-store', connectorHandler: createMockConnectorHandler() },
    },
    {
      description: 'connectorHandler with empty url (allowed)',
      config: { id: 'test-store', connectorHandler: createMockConnectorHandler(), url: '' },
    },
    {
      description: 'connectorHandler with empty dbName (allowed)',
      config: { id: 'test-store', connectorHandler: createMockConnectorHandler(), dbName: '' },
    },
    {
      description: 'disableInit with URL config',
      config: { id: 'test-store', url: 'mongodb://localhost:27017', dbName: 'test-db', disableInit: true },
    },
    {
      description: 'disableInit with connectorHandler',
      config: { id: 'test-store', connectorHandler: createMockConnectorHandler(), disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty url without connectorHandler',
      config: { id: 'test-store', url: '', dbName: 'test-db' },
      expectedError: /url must be provided and cannot be empty/,
    },
    {
      description: 'empty dbName without connectorHandler',
      config: { id: 'test-store', url: 'mongodb://localhost:27017', dbName: '' },
      expectedError: /dbName must be provided and cannot be empty/,
    },
    {
      description: 'missing dbName without connectorHandler',
      config: { id: 'test-store', url: 'mongodb://localhost:27017' },
      expectedError: /dbName must be provided and cannot be empty/,
    },
  ],
});

// Pre-configured client (connectorHandler) acceptance tests
// Note: MongoDB needs a real connection for init() to work (createIndex calls)
// So we use URL/dbName config which creates a real connection
createClientAcceptanceTests({
  storeName: 'MongoDBStore',
  expectedStoreName: 'MongoDBStore',
  createStoreWithClient: () => {
    return new MongoDBStore({
      id: 'mongodb-client-test',
      url: TEST_CONFIG.url!,
      dbName: TEST_CONFIG.dbName!,
    });
  },
});

// Domain-level pre-configured client tests
// Note: MongoDB domains need real connections, so we use URL/dbName config
// The connectorHandler variant is tested in store-specific tests below
createDomainDirectTests({
  storeName: 'MongoDB',
  createMemoryDomain: () =>
    new MemoryStorageMongoDB({
      url: TEST_CONFIG.url!,
      dbName: TEST_CONFIG.dbName!,
    }),
  createWorkflowsDomain: () =>
    new WorkflowsStorageMongoDB({
      url: TEST_CONFIG.url!,
      dbName: TEST_CONFIG.dbName!,
    }),
  createScoresDomain: () =>
    new ScoresStorageMongoDB({
      url: TEST_CONFIG.url!,
      dbName: TEST_CONFIG.dbName!,
    }),
});

// MongoDB-specific: connectorHandler with real operations
describe('MongoDBStore connectorHandler Operations', () => {
  it('should work with pre-configured connectorHandler for storage operations', async () => {
    const { handler, client } = await createConnectorHandler();

    const store = new MongoDBStore({
      id: 'mongodb-handler-ops-test',
      connectorHandler: handler,
    });

    await store.init();

    // Test a basic operation
    const thread = {
      id: `thread-handler-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const memoryStore = await store.getStore('memory');
    const savedThread = await memoryStore!.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    const retrievedThread = await memoryStore!.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toBeDefined();
    expect(retrievedThread?.title).toBe('Test Thread');

    // Clean up
    await memoryStore!.deleteThread({ threadId: thread.id });
    await store.close();
    await client.close();
  });

  it('should expose stores when using connectorHandler', () => {
    const store = new MongoDBStore({
      id: 'mongodb-handler-stores-test',
      connectorHandler: createMockConnectorHandler(),
    });

    expect(store).toBeDefined();
    expect(Object.keys(store.stores)).not.toHaveLength(0);
  });
});

// MongoDB-specific tests that demonstrate unique MongoDB capabilities
describe('MongoDB Specific Tests', () => {
  let store: MongoDBStore;

  beforeAll(async () => {
    store = new MongoDBStore(TEST_CONFIG);
    await store.init();
  });

  afterAll(async () => {
    try {
      await store.close();
    } catch {}
  });

  describe('MongoDB Connection Options', () => {
    it('should handle MongoDB Atlas connection strings', () => {
      const atlasConfig = {
        id: 'mongodb-atlas-test',
        url: 'mongodb+srv://user:pass@cluster.mongodb.net/',
        dbName: 'test-db',
        options: {
          retryWrites: true,
          w: 'majority' as const,
        },
      };
      expect(() => new MongoDBStore(atlasConfig)).not.toThrow();
    });

    it('should handle MongoDB connection with auth options', () => {
      const authConfig = {
        id: 'mongodb-auth-test',
        url: 'mongodb://user:pass@localhost:27017',
        dbName: 'test-db',
        options: {
          authSource: 'admin',
          authMechanism: 'SCRAM-SHA-1' as const,
        },
      };
      expect(() => new MongoDBStore(authConfig)).not.toThrow();
    });

    it('should handle MongoDB connection pool options', () => {
      const poolConfig = {
        id: 'mongodb-pool-test',
        url: 'mongodb://localhost:27017',
        dbName: 'test-db',
        options: {
          maxPoolSize: 50,
          minPoolSize: 5,
          maxIdleTimeMS: 30000,
          serverSelectionTimeoutMS: 5000,
        },
      };
      expect(() => new MongoDBStore(poolConfig)).not.toThrow();
    });
  });

  describe('MongoDB Document Flexibility', () => {
    beforeEach(async () => {
      await store.stores.memory.dangerouslyClearAll();
    });

    it('should handle flexible document schemas with complex nested metadata', async () => {
      // Test that MongoDB can store complex nested structures in thread metadata
      const thread = {
        id: `test-thread-${Date.now()}`,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {
          customField: 'custom value',
          nestedObject: {
            level1: {
              level2: 'deep value',
              arrayField: [1, 2, 3, 'mixed', { nested: true }],
            },
          },
          booleanField: true,
          numberField: 42.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // MongoDB should handle this flexible schema without issues
      const memoryStore = await store.getStore('memory');
      const saved = await memoryStore!.saveThread({ thread });
      expect(saved).toBeTruthy();
      expect(saved.id).toBe(thread.id);

      const retrieved = await memoryStore!.getThreadById({ threadId: thread.id });
      expect(retrieved).toBeTruthy();
      expect(retrieved?.metadata).toMatchObject({
        customField: 'custom value',
        booleanField: true,
        numberField: 42.5,
      });
      // Verify nested structure is preserved
      expect((retrieved?.metadata as any)?.nestedObject?.level1?.level2).toBe('deep value');
    });

    it('should preserve complex metadata types in threads', async () => {
      const thread = {
        id: `mongo-types-test-${Date.now()}`,
        resourceId: 'resource-1',
        title: 'Type Test Thread',
        metadata: {
          geoLocation: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749], // San Francisco
          },
          tags: ['ai', 'mongodb', 'flexible'],
          scores: { accuracy: 0.95, speed: 0.87 },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const memoryStore = await store.getStore('memory');
      await memoryStore!.saveThread({ thread });

      const retrieved = await memoryStore!.getThreadById({ threadId: thread.id });
      expect(retrieved).toBeTruthy();
      expect((retrieved?.metadata as any)?.geoLocation?.coordinates).toEqual([-122.4194, 37.7749]);
      expect((retrieved?.metadata as any)?.tags).toEqual(['ai', 'mongodb', 'flexible']);
    });
  });

  describe('MongoDB JSON/JSONB Field Handling', () => {
    beforeEach(async () => {
      await store.stores.memory.dangerouslyClearAll();
    });

    it('should handle complex JSON structures in message content', async () => {
      // First create a thread
      const threadId = `thread-json-test-${Date.now()}`;
      const resourceId = 'resource-json-test';
      const memoryStore = await store.getStore('memory');
      await memoryStore!.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'JSON Test Thread',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const messageId = `msg-json-test-${Date.now()}`;
      const complexMessage = {
        id: messageId,
        threadId,
        resourceId,
        role: 'assistant' as const,
        type: 'v2' as const,
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'text' as const,
              text: 'Here is a complex response',
            },
          ],
          metadata: {
            processingTime: 1250,
            model: 'gpt-4',
            usage: {
              promptTokens: 150,
              completionTokens: 75,
              totalTokens: 225,
            },
            // Test deeply nested structures
            reasoning: {
              steps: ['Parse user request', 'Identify location', 'Call weather API', 'Format response'],
              confidence: 0.95,
              nestedData: {
                level1: {
                  level2: {
                    level3: 'deep value',
                  },
                },
              },
            },
          },
        },
        createdAt: new Date(),
      };

      // MongoDB should handle this complex nested structure naturally
      const result = await memoryStore!.saveMessages({ messages: [complexMessage] });
      expect(result.messages).toHaveLength(1);

      const { messages } = await memoryStore!.listMessagesById({ messageIds: [messageId] });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBeDefined();
    });
  });

  describe('MongoDB Schemaless Collection Behavior', () => {
    it('should create collections on-demand when using connector directly', async () => {
      // This tests MongoDB's schemaless nature - collections are created automatically
      const testCollectionName = `test_dynamic_${Date.now()}`;

      // Access connector directly to test schemaless behavior
      const connector = (store as any)['#connector'] || (store as any).connector;

      // If we can't access connector directly, skip this test
      if (!connector) {
        console.log('Skipping schemaless test - connector not accessible');
        return;
      }

      const collection = await connector.getCollection(testCollectionName);

      // Insert a document - collection should be created automatically
      await collection.insertOne({
        id: 'test-1',
        dynamicField: 'this collection did not exist before',
        createdAt: new Date(),
      });

      // Verify document was inserted
      const doc = await collection.findOne({ id: 'test-1' });
      expect(doc).toBeTruthy();
      expect(doc?.dynamicField).toBe('this collection did not exist before');

      // Cleanup
      await collection.drop();
    });
  });

  describe('MongoDB Span Operations with Complex Data', () => {
    beforeEach(async () => {
      await store.stores.observability!.dangerouslyClearAll();
    });

    it('should handle Span creation with MongoDB-specific nested attributes', async () => {
      const spanId = `mongodb-span-${Date.now()}`;
      const traceId = `mongodb-trace-${Date.now()}`;

      const span = {
        spanId,
        traceId,
        name: 'MongoDB AI Operation',
        spanType: SpanType.MODEL_GENERATION,
        parentSpanId: null,
        scope: {
          name: 'mongodb-test',
          version: '1.0.0',
        },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          // MongoDB can store complex nested attributes natively
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            reasoningTokens: 25,
          },
          parameters: {
            temperature: 0.7,
            maxTokens: 1000,
            topP: 0.9,
          },
        },
        metadata: {
          environment: 'test',
          region: 'us-west-2',
          customTags: ['mongodb', 'ai', 'testing'],
          performance: {
            latency: 1250,
            throughput: 45.6,
          },
        },
        input: {
          messages: [{ role: 'user', content: 'Test prompt for MongoDB' }],
        },
        output: {
          message: { role: 'assistant', content: 'MongoDB response' },
          finishReason: 'stop',
        },
        startedAt: new Date('2025-10-17T10:00:00Z'),
        endedAt: new Date('2025-10-17T10:00:05Z'),
        isEvent: false,
        links: null,
        error: null,
      };

      const observabilityStore = await store.getStore('observability');
      await expect(observabilityStore!.createSpan(span)).resolves.not.toThrow();

      // Verify the span was created
      const trace = await observabilityStore!.getTrace(traceId);
      expect(trace).toBeTruthy();
      expect(trace?.spans).toHaveLength(1);
      expect(trace?.spans[0]?.spanId).toBe(spanId);
    });

    it('should handle Span updates with complex nested data', async () => {
      const spanId = `update-span-${Date.now()}`;
      const traceId = `update-trace-${Date.now()}`;

      // Create initial span
      const initialSpan = {
        spanId,
        traceId,
        name: 'Updating Span',
        spanType: SpanType.AGENT_RUN,
        parentSpanId: null,
        scope: {
          name: 'test-scope',
          version: '1.0.0',
        },
        startedAt: new Date(),
        endedAt: null,
        attributes: { initial: true },
        metadata: { status: 'started' },
        input: null,
        output: null,
        error: null,
        isEvent: false,
        links: null,
      };

      const observabilityStore = await store.getStore('observability');
      await observabilityStore!.createSpan(initialSpan);

      // Update with complex nested data
      const updates = {
        endedAt: new Date(),
        output: {
          result: 'Task completed successfully',
          metrics: {
            tasksCompleted: 5,
            averageTime: 2.3,
            successRate: 0.95,
          },
          artifacts: [
            { type: 'file', name: 'result.json', size: 1024 },
            { type: 'log', name: 'execution.log', entries: 150 },
          ],
        },
        attributes: {
          final: true,
          agentSteps: 8,
          toolsUsed: ['weather_api', 'calculator', 'email_sender'],
        },
        metadata: {
          status: 'completed',
          performance: {
            cpuUsage: 45.2,
            memoryUsage: 128.5,
            networkCalls: 12,
          },
        },
      };

      await expect(
        observabilityStore!.updateSpan({
          spanId,
          traceId,
          updates,
        }),
      ).resolves.not.toThrow();

      // Verify updates were applied
      const trace = await observabilityStore!.getTrace(traceId);
      expect(trace?.spans[0]?.output).toBeDefined();
      expect(trace?.spans[0]?.endedAt).toBeDefined();
    });
  });
});

// Helper to check if a MongoDB index exists in a collection
const mongoIndexExists = async (dbName: string, namePattern: string): Promise<boolean> => {
  const client = new MongoClient(TEST_CONFIG.url!);
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(TABLE_THREADS);
    const indexes = await collection.indexes();
    return indexes.some((idx: { name?: string }) => idx.name?.toLowerCase().includes(namePattern.toLowerCase()));
  } catch {
    // Collection may not exist if skipDefaultIndexes is true
    return false;
  } finally {
    await client.close();
  }
};

// Store-level index configuration tests
// Uses unique database names to avoid index collision between tests
const storeTestId = Math.floor(Date.now() / 1000) % 100000;
let currentStoreTestDbName = '';

createStoreIndexTests({
  storeName: 'MongoDBStore',
  createDefaultStore: () => {
    currentStoreTestDbName = `idx_s_${storeTestId}_d`;
    return new MongoDBStore({
      id: 'mongodb-idx-default',
      url: TEST_CONFIG.url!,
      dbName: currentStoreTestDbName,
    });
  },
  createStoreWithSkipDefaults: () => {
    currentStoreTestDbName = `idx_s_${storeTestId}_s`;
    return new MongoDBStore({
      id: 'mongodb-idx-skip',
      url: TEST_CONFIG.url!,
      dbName: currentStoreTestDbName,
      skipDefaultIndexes: true,
    });
  },
  createStoreWithCustomIndexes: indexes => {
    currentStoreTestDbName = `idx_s_${storeTestId}_c`;
    return new MongoDBStore({
      id: 'mongodb-idx-custom',
      url: TEST_CONFIG.url!,
      dbName: currentStoreTestDbName,
      indexes: indexes.map(idx => ({
        collection: (idx as any).collection || TABLE_THREADS,
        keys: { [(idx as any).columns?.[0] || 'title']: 1 },
        options: { name: idx.name },
      })),
    });
  },
  createStoreWithInvalidTable: indexes => {
    currentStoreTestDbName = `idx_s_${storeTestId}_i`;
    return new MongoDBStore({
      id: 'mongodb-idx-invalid',
      url: TEST_CONFIG.url!,
      dbName: currentStoreTestDbName,
      indexes: indexes.map(idx => ({
        collection: (idx as any).collection || 'nonexistent_collection_xyz',
        keys: { [(idx as any).columns?.[0] || 'id']: 1 },
        options: { name: idx.name },
      })),
    });
  },
  indexExists: (_store, pattern) => mongoIndexExists(currentStoreTestDbName, pattern),
  defaultIndexPattern: 'resourceid',
  customIndexName: 'custom_mongo_test_idx',
  customIndexDef: {
    name: 'custom_mongo_test_idx',
    collection: TABLE_THREADS,
    columns: ['title'],
  },
  invalidTableIndexDef: {
    name: 'invalid_collection_idx',
    collection: 'nonexistent_collection_xyz',
    columns: ['id'],
  },
});

// Domain-level index configuration tests (using MemoryStorageMongoDB as representative)
// Uses unique database names to avoid index collision between tests
const domainTestId = (Math.floor(Date.now() / 1000) % 100000) + 1;
let currentDomainTestDbName = '';

createDomainIndexTests({
  domainName: 'MemoryStorageMongoDB',
  createDefaultDomain: () => {
    currentDomainTestDbName = `idx_d_${domainTestId}_d`;
    return new MemoryStorageMongoDB({
      url: TEST_CONFIG.url!,
      dbName: currentDomainTestDbName,
    });
  },
  createDomainWithSkipDefaults: () => {
    currentDomainTestDbName = `idx_d_${domainTestId}_s`;
    return new MemoryStorageMongoDB({
      url: TEST_CONFIG.url!,
      dbName: currentDomainTestDbName,
      skipDefaultIndexes: true,
    });
  },
  createDomainWithCustomIndexes: indexes => {
    currentDomainTestDbName = `idx_d_${domainTestId}_c`;
    return new MemoryStorageMongoDB({
      url: TEST_CONFIG.url!,
      dbName: currentDomainTestDbName,
      indexes: indexes.map(idx => ({
        collection: (idx as any).collection || TABLE_THREADS,
        keys: { [(idx as any).columns?.[0] || 'title']: 1 },
        options: { name: idx.name },
      })),
    });
  },
  createDomainWithInvalidTable: indexes => {
    currentDomainTestDbName = `idx_d_${domainTestId}_i`;
    return new MemoryStorageMongoDB({
      url: TEST_CONFIG.url!,
      dbName: currentDomainTestDbName,
      indexes: indexes.map(idx => ({
        collection: (idx as any).collection || 'nonexistent_collection_xyz',
        keys: { [(idx as any).columns?.[0] || 'id']: 1 },
        options: { name: idx.name },
      })),
    });
  },
  indexExists: (_domain, pattern) => mongoIndexExists(currentDomainTestDbName, pattern),
  defaultIndexPattern: 'resourceid',
  customIndexName: 'custom_memory_mongo_idx',
  customIndexDef: {
    name: 'custom_memory_mongo_idx',
    collection: TABLE_THREADS,
    columns: ['title'],
  },
  invalidTableIndexDef: {
    name: 'invalid_domain_collection_idx',
    collection: 'nonexistent_collection_xyz',
    columns: ['id'],
  },
});
