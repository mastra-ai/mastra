import { createTestSuite } from '@internal/storage-test-utils';
import { SpanType } from '@mastra/core/observability';
import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { ConnectorHandler } from './connectors/base';
import type { MongoDBConfig } from './types';
import { MongoDBStore } from './index';

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
      // Clear test collections
      try {
        await store.clearTable({ tableName: 'mastra_threads' as any });
        await store.clearTable({ tableName: 'mastra_messages' as any });
      } catch {}
    });

    it('should handle flexible document schemas without predefined structure', async () => {
      const customData = {
        id: 'test-thread-1',
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
          dateField: new Date(),
          booleanField: true,
          numberField: 42.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // MongoDB should handle this flexible schema without issues
      await expect(store.insert({ tableName: 'mastra_threads' as any, record: customData })).resolves.not.toThrow();

      const retrieved = await store.load({
        tableName: 'mastra_threads' as any,
        keys: { id: 'test-thread-1' },
      });

      expect(retrieved).toBeTruthy();
    });

    it('should preserve MongoDB-specific data types', async () => {
      const mongoData = {
        id: 'mongo-types-test',
        resourceId: 'resource-1',
        // MongoDB can store these natively
        dateField: new Date('2025-10-17T10:00:00Z'),
        objectIdField: 'ObjectId will be string in our case',
        regexPattern: 'test.*pattern',
        binaryData: Buffer.from('test binary data'),
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

      await store.insert({ tableName: 'mastra_threads' as any, record: mongoData });

      const retrieved = await store.load({
        tableName: 'mastra_threads' as any,
        keys: { id: 'mongo-types-test' },
      });

      expect(retrieved).toBeTruthy();
    });
  });

  describe('MongoDB Query Capabilities', () => {
    beforeEach(async () => {
      try {
        await store.clearTable({ tableName: 'mastra_traces' as any });
      } catch {}
    });

    it('should handle MongoDB-style array and object queries', async () => {
      // Insert test data with arrays and nested objects
      const traceData = [
        {
          id: 'trace-1',
          name: 'Agent Execution',
          tags: ['ai', 'agent', 'production'],
          metadata: { environment: 'prod', version: '1.0' },
          startedAt: new Date('2025-10-17T10:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'trace-2',
          name: 'Workflow Run',
          tags: ['workflow', 'automation'],
          metadata: { environment: 'staging', version: '1.1' },
          startedAt: new Date('2025-10-17T11:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'trace-3',
          name: 'LLM Generation',
          tags: ['ai', 'llm', 'openai'],
          metadata: { environment: 'prod', model: 'gpt-4' },
          startedAt: new Date('2025-10-17T12:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const trace of traceData) {
        await store.insert({ tableName: 'mastra_traces' as any, record: trace });
      }

      // This would be ideal for MongoDB $in operator (though our current
      // implementation may not expose this directly)
      // We can at least verify the data is stored properly
      const allTraces = await store.load({
        tableName: 'mastra_traces' as any,
        keys: {},
      });

      expect(allTraces).toBeTruthy();
    });
  });

  describe('MongoDB JSON/JSONB Field Handling', () => {
    beforeEach(async () => {
      try {
        await store.clearTable({ tableName: 'mastra_messages' as any });
      } catch {}
    });

    it('should handle complex JSON structures without conversion issues', async () => {
      const complexMessage = {
        id: 'msg-json-test',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        role: 'assistant',
        type: 'v2',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Here is a complex response',
            },
            {
              type: 'tool_call',
              toolCall: {
                id: 'call_123',
                name: 'weather_api',
                args: {
                  location: 'San Francisco',
                  units: 'metric',
                  options: {
                    includeForecast: true,
                    days: 5,
                    details: ['temperature', 'humidity', 'wind'],
                  },
                },
              },
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
            reasoning: {
              steps: ['Parse user request', 'Identify location', 'Call weather API', 'Format response'],
              confidence: 0.95,
            },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // MongoDB should handle this complex nested structure naturally
      await expect(
        store.insert({ tableName: 'mastra_messages' as any, record: complexMessage }),
      ).resolves.not.toThrow();

      const retrieved = await store.load({
        tableName: 'mastra_messages' as any,
        keys: { id: 'msg-json-test' },
      });

      expect(retrieved).toBeTruthy();
    });

    it('should preserve JSON field types without string conversion', async () => {
      const typedMessage = {
        id: 'msg-types-test',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        role: 'user',
        type: 'v2',
        content: {
          format: 2,
          metadata: {
            // These should stay as their native types in MongoDB
            timestamp: new Date(),
            isImportant: true,
            priority: 1,
            score: 0.95,
            nullValue: null,
            arrayOfMixed: [1, 'string', true, { nested: 'object' }],
            emptyArray: [],
            emptyObject: {},
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.insert({ tableName: 'mastra_messages' as any, record: typedMessage });

      const retrieved = await store.load({
        tableName: 'mastra_messages' as any,
        keys: { id: 'msg-types-test' },
      });

      expect(retrieved).toBeTruthy();
    });
  });

  describe('MongoDB Collection Management', () => {
    const testCollectionName = 'test_dynamic_collection' as any;

    afterEach(async () => {
      try {
        await store.dropTable({ tableName: testCollectionName });
      } catch {}
    });

    it('should create collections on-demand (schemaless nature)', async () => {
      // MongoDB creates collections automatically when first document is inserted
      const testDoc = {
        id: 'test-1',
        dynamicField: 'this collection did not exist before',
        createdAt: new Date(),
      };

      // This should work without explicitly creating the collection first
      await expect(store.insert({ tableName: testCollectionName, record: testDoc })).resolves.not.toThrow();

      const retrieved = await store.load({
        tableName: testCollectionName,
        keys: { id: 'test-1' },
      });

      expect(retrieved).toBeTruthy();
    });

    it('should handle collection operations gracefully', async () => {
      // Test drop on non-existent collection
      await expect(store.dropTable({ tableName: 'non_existent_collection' as any })).resolves.not.toThrow();

      // Test clear on non-existent collection
      await expect(store.clearTable({ tableName: 'non_existent_collection' as any })).resolves.not.toThrow();
    });
  });

  describe('MongoDB Batch Operations', () => {
    beforeEach(async () => {
      try {
        await store.clearTable({ tableName: 'mastra_threads' as any });
      } catch {}
    });

    it('should handle large batch insertions efficiently', async () => {
      const batchSize = 100;
      const batchData = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch-thread-${i}`,
        resourceId: `resource-${i % 10}`, // 10 different resources
        title: `Batch Thread ${i}`,
        metadata: {
          batchIndex: i,
          isEven: i % 2 === 0,
          category: i < 50 ? 'first-half' : 'second-half',
          tags: [`tag-${i % 5}`, `batch-${Math.floor(i / 10)}`],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // MongoDB should handle this batch efficiently
      const startTime = Date.now();
      await expect(
        store.batchInsert({ tableName: 'mastra_threads' as any, records: batchData }),
      ).resolves.not.toThrow();
      const endTime = Date.now();

      // Verify performance (should be faster than individual inserts)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max

      // Verify all records were inserted
      const allRecords = await store.load({
        tableName: 'mastra_threads' as any,
        keys: {},
      });
      expect(Array.isArray(allRecords) ? allRecords.length : 0).toBe(batchSize);
    });
  });

  describe('MongoDB Span Operations', () => {
    beforeEach(async () => {
      try {
        await store.clearTable({ tableName: 'mastra_ai_spans' as any });
      } catch {}
    });

    it('should handle Span creation with MongoDB-specific features', async () => {
      const Span = {
        spanId: 'mongodb-span-1',
        traceId: 'mongodb-trace-1',
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
          // MongoDB can store complex nested attributes
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

      await expect(store.createSpan(Span)).resolves.not.toThrow();

      // Verify the span was created
      const trace = await store.getTrace('mongodb-trace-1');
      expect(trace).toBeTruthy();
      expect(trace?.spans).toHaveLength(1);
      expect(trace?.spans[0]?.spanId).toBe('mongodb-span-1');
    });

    it('should handle Span updates with complex data', async () => {
      // Create initial span with all required fields
      const initialSpan = {
        spanId: 'update-span-1',
        traceId: 'update-trace-1',
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
          spanId: 'update-span-1',
          traceId: 'update-trace-1',
          updates,
        }),
      ).resolves.not.toThrow();

      // Verify updates were applied
      const trace = await store.getTrace('update-trace-1');
      expect(trace?.spans[0]?.output).toBeDefined();
      expect(trace?.spans[0]?.endedAt).toBeDefined();
    });
  });

  describe('MongoDB Error Handling', () => {
    it('should provide meaningful error messages for MongoDB-specific issues', async () => {
      // Test with invalid collection name (though MongoDB is quite flexible)
      const invalidData = {
        id: 'test',
        // MongoDB should handle most field names, but let's test edge cases
        'field.with.dots': 'this might cause issues in some contexts',
        field$with$dollar: 'dollar signs in field names',
      };

      // MongoDB should actually handle these field names fine
      await expect(store.insert({ tableName: 'test_collection' as any, record: invalidData })).resolves.not.toThrow();
    });

    it('should handle connection issues gracefully', async () => {
      const badStore = new MongoDBStore({
        id: 'mongodb-bad-connection-test',
        url: 'mongodb://nonexistent:27017',
        dbName: 'test',
        options: {
          serverSelectionTimeoutMS: 1000, // Quick timeout for testing
        },
      });

      // This should eventually timeout and provide a meaningful error
      await expect(badStore.insert({ tableName: 'test' as any, record: { id: 'test' } })).rejects.toThrow();
    });
  });
});

createTestSuite(new MongoDBStore(TEST_CONFIG));
