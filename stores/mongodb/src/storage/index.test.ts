import { createTestSuite } from '@internal/storage-test-utils';
import { SpanType } from '@mastra/core/observability';
import { MongoClient } from 'mongodb';
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { ConnectorHandler } from './connectors/base';
import type { MongoDBConfig } from './types';
import { MongoDBStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_CONFIG: MongoDBConfig = {
  id: 'mongodb-test-store',
  url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-test-db',
};

describe('MongoDB Store Validation', () => {
  describe('with database options', () => {
    const validConfig = TEST_CONFIG;
    it('throws if url is empty', () => {
      expect(() => new MongoDBStore({ ...validConfig, url: '' })).toThrow(/url must be provided and cannot be empty/);
    });

    it('throws if dbName is missing or empty', () => {
      expect(() => new MongoDBStore({ ...validConfig, dbName: '' })).toThrow(
        /dbName must be provided and cannot be empty/,
      );
      const { dbName, ...rest } = validConfig;
      expect(() => new MongoDBStore(rest as any)).toThrow(/dbName must be provided and cannot be empty/);
    });

    it('does not throw on valid config (host-based)', () => {
      expect(() => new MongoDBStore(validConfig)).not.toThrow();
    });
  });

  describe('with connection handler', () => {
    const validWithConnectionHandlerConfig = {
      id: 'mongodb-handler-test',
      connectorHandler: {} as ConnectorHandler,
    };

    it('not throws if url is empty', () => {
      expect(() => new MongoDBStore({ ...validWithConnectionHandlerConfig, url: '' })).not.toThrow(
        /url must be provided and cannot be empty/,
      );
    });

    it('not throws if dbName is missing or empty', () => {
      expect(() => new MongoDBStore({ ...validWithConnectionHandlerConfig, dbName: '' })).not.toThrow(
        /dbName must be provided and cannot be empty/,
      );
      const { dbName, ...rest } = validWithConnectionHandlerConfig as any;
      expect(() => new MongoDBStore(rest as any)).not.toThrow(/dbName must be provided and cannot be empty/);
    });

    it('does not throw on valid config', () => {
      expect(() => new MongoDBStore(validWithConnectionHandlerConfig)).not.toThrow();
    });

    it('should initialize the stores correctly', () => {
      const store = new MongoDBStore(validWithConnectionHandlerConfig);
      expect(Object.keys(store.stores)).not.toHaveLength(0);
    });
  });
});

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
          w: 'majority',
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
          authMechanism: 'SCRAM-SHA-1',
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
        spanType: SpanType.LLM_GENERATION,
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

// Run the shared test suite
createTestSuite(new MongoDBStore(TEST_CONFIG));

describe('MongoDBStore with pre-configured connectorHandler', () => {
  it('should accept a connectorHandler with getClient and getDb', () => {
    const mockClient = {} as MongoClient;
    const mockDb = {} as ReturnType<MongoClient['db']>;

    const connectorHandler: ConnectorHandler = {
      getClient: () => mockClient,
      getDb: () => mockDb,
    };

    const store = new MongoDBStore({
      id: 'mongodb-handler-test',
      connectorHandler,
    });

    expect(store).toBeDefined();
    expect(Object.keys(store.stores)).not.toHaveLength(0);
  });

  it('should work with pre-configured connectorHandler for storage operations', async () => {
    // This test uses a real MongoDB connection through connectorHandler
    const client = new MongoClient(TEST_CONFIG.url!);

    const connectorHandler: ConnectorHandler = {
      getClient: () => client,
      getDb: () => client.db(TEST_CONFIG.dbName),
    };

    const store = new MongoDBStore({
      id: 'mongodb-handler-ops-test',
      connectorHandler,
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
  });
});

describe('MongoDBStore Configuration Validation - Extended', () => {
  describe('with URL/dbName config', () => {
    it('should accept valid URL/dbName config', () => {
      expect(
        () =>
          new MongoDBStore({
            id: 'test-store',
            url: 'mongodb://localhost:27017',
            dbName: 'test-db',
          }),
      ).not.toThrow();
    });

    it('should accept config with options', () => {
      expect(
        () =>
          new MongoDBStore({
            id: 'test-store',
            url: 'mongodb://localhost:27017',
            dbName: 'test-db',
            options: {
              maxPoolSize: 50,
              minPoolSize: 5,
            },
          }),
      ).not.toThrow();
    });
  });

  describe('with connectorHandler', () => {
    it('should accept a connectorHandler', () => {
      const connectorHandler: ConnectorHandler = {
        getClient: () => ({}) as MongoClient,
        getDb: () => ({}) as ReturnType<MongoClient['db']>,
      };

      expect(
        () =>
          new MongoDBStore({
            id: 'test-store',
            connectorHandler,
          }),
      ).not.toThrow();
    });

    it('should not require url when connectorHandler is provided', () => {
      const connectorHandler: ConnectorHandler = {
        getClient: () => ({}) as MongoClient,
        getDb: () => ({}) as ReturnType<MongoClient['db']>,
      };

      expect(
        () =>
          new MongoDBStore({
            id: 'test-store',
            connectorHandler,
            url: '', // Empty URL should be allowed when handler is provided
          }),
      ).not.toThrow();
    });

    it('should not require dbName when connectorHandler is provided', () => {
      const connectorHandler: ConnectorHandler = {
        getClient: () => ({}) as MongoClient,
        getDb: () => ({}) as ReturnType<MongoClient['db']>,
      };

      expect(
        () =>
          new MongoDBStore({
            id: 'test-store',
            connectorHandler,
            dbName: '', // Empty dbName should be allowed when handler is provided
          }),
      ).not.toThrow();
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with URL config', () => {
      expect(
        () =>
          new MongoDBStore({
            id: 'test-store',
            url: 'mongodb://localhost:27017',
            dbName: 'test-db',
            disableInit: true,
          }),
      ).not.toThrow();
    });

    it('should accept disableInit: true with connectorHandler', () => {
      const connectorHandler: ConnectorHandler = {
        getClient: () => ({}) as MongoClient,
        getDb: () => ({}) as ReturnType<MongoClient['db']>,
      };

      expect(
        () =>
          new MongoDBStore({
            id: 'test-store',
            connectorHandler,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});

describe('MongoDB Domain-level Pre-configured Client', () => {
  it('should allow using MemoryStorageMongoDB domain directly with connectorHandler', async () => {
    const client = new MongoClient(TEST_CONFIG.url!);

    const connectorHandler: ConnectorHandler = {
      getClient: () => client,
      getDb: () => client.db(TEST_CONFIG.dbName),
    };

    // Import and use the domain class directly
    const { MemoryStorageMongoDB } = await import('./domains/memory');

    const memoryDomain = new MemoryStorageMongoDB({ connectorHandler });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    // Test a basic operation
    const thread = {
      id: `thread-domain-test-${Date.now()}`,
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
    const client = new MongoClient(TEST_CONFIG.url!);

    const connectorHandler: ConnectorHandler = {
      getClient: () => client,
      getDb: () => client.db(TEST_CONFIG.dbName),
    };

    // Import and use the domain class directly
    const { WorkflowsStorageMongoDB } = await import('./domains/workflows');

    const workflowsDomain = new WorkflowsStorageMongoDB({ connectorHandler });

    expect(workflowsDomain).toBeDefined();
    await workflowsDomain.init();

    // Test a basic operation
    const workflowName = 'test-workflow';
    const runId = `run-domain-test-${Date.now()}`;

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
    const client = new MongoClient(TEST_CONFIG.url!);

    const connectorHandler: ConnectorHandler = {
      getClient: () => client,
      getDb: () => client.db(TEST_CONFIG.dbName),
    };

    // Import and use the domain class directly
    const { ScoresStorageMongoDB } = await import('./domains/scores');

    const scoresDomain = new ScoresStorageMongoDB({ connectorHandler });

    expect(scoresDomain).toBeDefined();
    await scoresDomain.init();

    // Test a basic operation - SaveScorePayload requires runId, scorer, output, input, entity, and other fields
    const savedScore = await scoresDomain.saveScore({
      runId: `run-score-test-${Date.now()}`,
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

  it('should allow domains to accept URL/dbName config directly', async () => {
    // Import and use the domain class directly
    const { MemoryStorageMongoDB } = await import('./domains/memory');

    // Domains can also accept standard URL/dbName config
    const memoryDomain = new MemoryStorageMongoDB({
      url: TEST_CONFIG.url!,
      dbName: TEST_CONFIG.dbName!,
    });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    // Test a basic operation to verify it works
    const thread = {
      id: `thread-url-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test URL Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await memoryDomain.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    // Clean up
    await memoryDomain.deleteThread({ threadId: thread.id });
  });
});
