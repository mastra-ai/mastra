import {
  createTestSuite,
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { SpanType } from '@mastra/core/observability';
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

    const savedThread = await store.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    const retrievedThread = await store.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toBeDefined();
    expect(retrievedThread?.title).toBe('Test Thread');

    // Clean up
    await store.deleteThread({ threadId: thread.id });
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

// MongoDB-specific: Domain with connectorHandler
describe('MongoDB Domain connectorHandler', () => {
  it('should allow using MemoryStorageMongoDB domain directly with connectorHandler', async () => {
    const { handler, client } = await createConnectorHandler();

    const memoryDomain = new MemoryStorageMongoDB({ connectorHandler: handler });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    // Test a basic operation
    const thread = {
      id: `thread-domain-handler-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test Domain Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await memoryDomain.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    const retrievedThread = await memoryDomain.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toBeDefined();
    expect(retrievedThread?.title).toBe('Test Domain Thread');

    // Clean up
    await memoryDomain.deleteThread({ threadId: thread.id });
    await client.close();
  });

  it('should allow using WorkflowsStorageMongoDB domain directly with connectorHandler', async () => {
    const { handler, client } = await createConnectorHandler();

    const workflowsDomain = new WorkflowsStorageMongoDB({ connectorHandler: handler });

    expect(workflowsDomain).toBeDefined();
    await workflowsDomain.init();

    // Test a basic operation
    const workflowName = 'test-workflow';
    const runId = `run-domain-handler-test-${Date.now()}`;

    await workflowsDomain.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: {
        runId,
        value: { current_step: 'initial' },
        context: { requestContext: {} },
        activePaths: [],
        suspendedPaths: {},
        timestamp: Date.now(),
      } as any,
    });

    const snapshot = await workflowsDomain.loadWorkflowSnapshot({ workflowName, runId });
    expect(snapshot).toBeDefined();
    expect(snapshot?.runId).toBe(runId);

    // Clean up
    await workflowsDomain.deleteWorkflowRunById({ workflowName, runId });
    await client.close();
  });

  it('should allow using ScoresStorageMongoDB domain directly with connectorHandler', async () => {
    const { handler, client } = await createConnectorHandler();

    const scoresDomain = new ScoresStorageMongoDB({ connectorHandler: handler });

    expect(scoresDomain).toBeDefined();
    await scoresDomain.init();

    // Test a basic operation
    const savedScore = await scoresDomain.saveScore({
      runId: `run-score-handler-test-${Date.now()}`,
      score: 0.95,
      scorerId: 'test-scorer',
      scorer: { name: 'test-scorer', description: 'A test scorer' },
      input: { query: 'test input' },
      output: { result: 'test output' },
      entity: { id: 'test-entity', type: 'agent' },
      entityType: 'AGENT',
      entityId: 'test-entity',
      source: 'LIVE',
      traceId: 'test-trace',
      spanId: 'test-span',
    });

    expect(savedScore.score.id).toBeDefined();
    expect(savedScore.score.score).toBe(0.95);

    const retrievedScore = await scoresDomain.getScoreById({ id: savedScore.score.id });
    expect(retrievedScore).toBeDefined();
    expect(retrievedScore?.score).toBe(0.95);

    await client.close();
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
      const saved = await store.saveThread({ thread });
      expect(saved).toBeTruthy();
      expect(saved.id).toBe(thread.id);

      const retrieved = await store.getThreadById({ threadId: thread.id });
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

      await store.saveThread({ thread });

      const retrieved = await store.getThreadById({ threadId: thread.id });
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
      await store.saveThread({
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
      const result = await store.saveMessages({ messages: [complexMessage] });
      expect(result.messages).toHaveLength(1);

      const { messages } = await store.listMessagesById({ messageIds: [messageId] });
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

      await expect(store.createSpan(span)).resolves.not.toThrow();

      // Verify the span was created
      const trace = await store.getTrace(traceId);
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

      await store.createSpan(initialSpan);

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
        store.updateSpan({
          spanId,
          traceId,
          updates,
        }),
      ).resolves.not.toThrow();

      // Verify updates were applied
      const trace = await store.getTrace(traceId);
      expect(trace?.spans[0]?.output).toBeDefined();
      expect(trace?.spans[0]?.endedAt).toBeDefined();
    });
  });
});
