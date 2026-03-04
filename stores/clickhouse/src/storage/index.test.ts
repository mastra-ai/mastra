import { createClient } from '@clickhouse/client';
import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { describe, expect, it, vi } from 'vitest';

import { MemoryStorageClickhouse } from './domains/memory';
import { ScoresStorageClickhouse } from './domains/scores';
import { WorkflowsStorageClickhouse } from './domains/workflows';
import { ClickhouseStore } from '.';
import type { ClickhouseConfig } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_CONFIG: ClickhouseConfig = {
  id: 'clickhouse-test',
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
};

// Helper to create a fresh client for each test
const createTestClient = () =>
  createClient({
    url: TEST_CONFIG.url,
    username: TEST_CONFIG.username,
    password: TEST_CONFIG.password,
  });

const storage = new ClickhouseStore(TEST_CONFIG);

createTestSuite(storage);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'ClickhouseStore',
  createStore: config => new ClickhouseStore(config as any),
  validConfigs: [
    {
      description: 'URL/credentials config',
      config: { id: 'test-store', url: 'http://localhost:8123', username: 'default', password: 'password' },
    },
    {
      description: 'empty string for username and password (default user)',
      config: { id: 'test-store', url: 'http://localhost:8123', username: '', password: '' },
    },
    {
      description: 'config with TTL options',
      config: {
        id: 'test-store',
        url: 'http://localhost:8123',
        username: 'default',
        password: 'password',
        ttl: { mastra_traces: { row: { interval: 600, unit: 'SECOND' } } },
      },
    },
    { description: 'pre-configured client', config: { id: 'test-store', client: createTestClient() } },
    {
      description: 'client with TTL options',
      config: {
        id: 'test-store',
        client: createTestClient(),
        ttl: { mastra_traces: { row: { interval: 600, unit: 'SECOND' } } },
      },
    },
    {
      description: 'disableInit with URL config',
      config: {
        id: 'test-store',
        url: 'http://localhost:8123',
        username: 'default',
        password: 'password',
        disableInit: true,
      },
    },
    {
      description: 'disableInit with client config',
      config: { id: 'test-store', client: createTestClient(), disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty url',
      config: { id: 'test-store', url: '', username: 'default', password: 'password' },
      expectedError: /url is required/i,
    },
    {
      description: 'username not a string',
      config: { id: 'test-store', url: 'http://localhost:8123', username: undefined, password: 'password' },
      expectedError: /username must be a string/i,
    },
    {
      description: 'password not a string',
      config: { id: 'test-store', url: 'http://localhost:8123', username: 'default', password: undefined },
      expectedError: /password must be a string/i,
    },
  ],
});

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'ClickhouseStore',
  expectedStoreName: 'ClickhouseStore',
  createStoreWithClient: () =>
    new ClickhouseStore({
      id: 'clickhouse-client-test',
      client: createTestClient(),
    }),
  createStoreWithClientAndOptions: () =>
    new ClickhouseStore({
      id: 'clickhouse-client-opts-test',
      client: createTestClient(),
      ttl: { mastra_traces: { row: { interval: 600, unit: 'SECOND' } } },
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'ClickHouse',
  createMemoryDomain: () => new MemoryStorageClickhouse({ client: createTestClient() }),
  createWorkflowsDomain: () => new WorkflowsStorageClickhouse({ client: createTestClient() }),
  createScoresDomain: () => new ScoresStorageClickhouse({ client: createTestClient() }),
  createMemoryDomainWithOptions: () =>
    new MemoryStorageClickhouse({
      client: createTestClient(),
      ttl: { mastra_threads: { row: { interval: 30, unit: 'DAY' } } },
    }),
});

// Additional ClickHouse-specific tests
describe('ClickHouse Domain with URL/credentials config', () => {
  it('should allow domains to accept URL/credentials config directly', async () => {
    const memoryDomain = new MemoryStorageClickhouse({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username || 'default',
      password: TEST_CONFIG.password || '',
    });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

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

    await memoryDomain.deleteThread({ threadId: thread.id });
  });

  // Test empty/null/malformed metadata handling
  describe('Thread Metadata Handling', () => {
    it('should handle threads with empty string metadata without crashing', async () => {
      const memoryDomain = new MemoryStorageClickhouse({
        url: TEST_CONFIG.url,
        username: TEST_CONFIG.username || 'default',
        password: TEST_CONFIG.password || '',
      });

      await memoryDomain.init();

      const threadId = `thread-empty-metadata-${Date.now()}`;
      const resourceId = 'test-resource-empty-meta';

      // Simulate a thread with empty string metadata by inserting directly
      // This bypasses serializeMetadata() to reproduce the exact scenario from the issue
      const client = createTestClient();
      await client.insert({
        table: 'mastra_threads',
        values: [
          {
            id: threadId,
            resourceId: resourceId,
            title: 'Test Thread with Empty Metadata',
            metadata: '', // Empty string - the problematic case
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Test 1: getThreadById should not crash with empty metadata
      const thread = await memoryDomain.getThreadById({ threadId });
      expect(thread).toBeDefined();
      expect(thread?.id).toBe(threadId);
      expect(thread?.metadata).toEqual({}); // Should return empty object, not crash

      // Test 2: saveMessages should work even if thread has empty metadata
      const message = {
        id: `msg-${Date.now()}`,
        threadId: threadId,
        resourceId: resourceId,
        content: 'Test message',
        role: 'user' as const,
        type: 'v2' as const,
        createdAt: new Date(),
      };

      // saveMessages should work even with empty metadata
      await expect(memoryDomain.saveMessages({ messages: [message] })).resolves.toBeDefined();

      // Cleanup
      await memoryDomain.deleteThread({ threadId });
      await client.close();
    });

    it('should handle threads with null metadata without crashing', async () => {
      const memoryDomain = new MemoryStorageClickhouse({
        url: TEST_CONFIG.url,
        username: TEST_CONFIG.username || 'default',
        password: TEST_CONFIG.password || '',
      });

      await memoryDomain.init();

      const threadId = `thread-null-metadata-${Date.now()}`;
      const resourceId = 'test-resource-null-meta';

      // Insert thread with null metadata
      const client = createTestClient();
      await client.insert({
        table: 'mastra_threads',
        values: [
          {
            id: threadId,
            resourceId: resourceId,
            title: 'Test Thread with Null Metadata',
            metadata: null, // Null metadata
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Should handle null metadata gracefully
      const thread = await memoryDomain.getThreadById({ threadId });
      expect(thread).toBeDefined();
      expect(thread?.metadata).toEqual({});

      // Cleanup
      await memoryDomain.deleteThread({ threadId });
      await client.close();
    });

    it('should handle threads with malformed JSON metadata without crashing', async () => {
      const memoryDomain = new MemoryStorageClickhouse({
        url: TEST_CONFIG.url,
        username: TEST_CONFIG.username || 'default',
        password: TEST_CONFIG.password || '',
      });

      await memoryDomain.init();

      const threadId = `thread-malformed-metadata-${Date.now()}`;
      const resourceId = 'test-resource-malformed-meta';

      // Insert thread with malformed JSON
      const client = createTestClient();
      await client.insert({
        table: 'mastra_threads',
        values: [
          {
            id: threadId,
            resourceId: resourceId,
            title: 'Test Thread with Malformed JSON',
            metadata: '{invalid json', // Malformed JSON
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Should handle malformed JSON gracefully
      const thread = await memoryDomain.getThreadById({ threadId });
      expect(thread).toBeDefined();
      expect(thread?.metadata).toEqual({});

      // Cleanup
      await memoryDomain.deleteThread({ threadId });
      await client.close();
    });

    it('should apply DEFAULT constraint to metadata column on new tables', async () => {
      const memoryDomain = new MemoryStorageClickhouse({
        url: TEST_CONFIG.url,
        username: TEST_CONFIG.username || 'default',
        password: TEST_CONFIG.password || '',
      });

      // Drop and recreate table to ensure we get fresh schema with DEFAULT
      const client = createTestClient();
      await client.command({
        query: 'DROP TABLE IF EXISTS mastra_threads',
      });

      await memoryDomain.init();

      // Check if DEFAULT constraint was applied by querying table schema
      const describeResult = await client.query({
        query: 'DESCRIBE TABLE mastra_threads',
        format: 'JSONEachRow',
      });
      const columns = (await describeResult.json()) as Array<{ name: string; default_expression: string }>;
      const metadataColumn = columns.find(col => col.name === 'metadata');

      // Verify DEFAULT '{}' was applied
      expect(metadataColumn).toBeDefined();
      expect(metadataColumn?.default_expression).toBe("'{}'");

      await client.close();
    });

    it('should handle old tables without DEFAULT constraint', async () => {
      const client = createTestClient();

      // Manually create an OLD table WITHOUT the DEFAULT constraint
      // This simulates tables created before Dec 18, 2025
      await client.command({
        query: 'DROP TABLE IF EXISTS mastra_threads',
      });

      await client.command({
        query: `
          CREATE TABLE IF NOT EXISTS mastra_threads (
            "id" String,
            "resourceId" String,
            "title" String,
            "metadata" Nullable(String),
            "createdAt" DateTime64(3),
            "updatedAt" DateTime64(3)
          )
          ENGINE = ReplacingMergeTree()
          PRIMARY KEY (createdAt, id)
          ORDER BY (createdAt, id)
          SETTINGS index_granularity = 8192
        `,
      });

      const memoryDomain = new MemoryStorageClickhouse({
        url: TEST_CONFIG.url,
        username: TEST_CONFIG.username || 'default',
        password: TEST_CONFIG.password || '',
      });

      // Don't call init() - we want to use the manually created table
      const threadId = `thread-old-table-${Date.now()}`;
      const resourceId = 'test-resource-old-table';

      // Insert thread with empty metadata (simulating the bug)
      await client.insert({
        table: 'mastra_threads',
        values: [
          {
            id: threadId,
            resourceId: resourceId,
            title: 'Test Thread in Old Table',
            metadata: '', // Empty string - would have caused crash before parseMetadata()
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // parseMetadata() should save us even with old table structure
      const thread = await memoryDomain.getThreadById({ threadId });
      expect(thread).toBeDefined();
      expect(thread?.metadata).toEqual({});

      // saveMessages should also work
      const message = {
        id: `msg-${Date.now()}`,
        threadId: threadId,
        resourceId: resourceId,
        content: 'Test message',
        role: 'user' as const,
        type: 'v2' as const,
        createdAt: new Date(),
      };

      await expect(memoryDomain.saveMessages({ messages: [message] })).resolves.toBeDefined();

      // Cleanup
      await memoryDomain.deleteThread({ threadId });
      await client.close();
    });

    it('should use DEFAULT value when inserting thread without metadata via saveThread', async () => {
      const memoryDomain = new MemoryStorageClickhouse({
        url: TEST_CONFIG.url,
        username: TEST_CONFIG.username || 'default',
        password: TEST_CONFIG.password || '',
      });

      const client = createTestClient();

      // Drop and recreate to ensure DEFAULT is applied
      await client.command({
        query: 'DROP TABLE IF EXISTS mastra_threads',
      });

      await memoryDomain.init();

      const threadId = `thread-default-test-${Date.now()}`;
      const resourceId = 'test-resource-default';

      // Use saveThread which calls serializeMetadata(), but let's verify DB level
      const thread = {
        id: threadId,
        resourceId: resourceId,
        title: 'Test Thread',
        metadata: {}, // Empty object
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await memoryDomain.saveThread({ thread });

      // Query DB directly to see what was actually stored
      const result = await client.query({
        query: 'SELECT metadata FROM mastra_threads WHERE id = {threadId:String}',
        query_params: { threadId },
        format: 'JSONEachRow',
      });

      const rows = (await result.json()) as Array<{ metadata: string }>;
      expect(rows.length).toBe(1);
      expect(rows[0].metadata).toBe('{}'); // Should be stored as '{}'

      // Cleanup
      await memoryDomain.deleteThread({ threadId });
      await client.close();
    });
  });
});
