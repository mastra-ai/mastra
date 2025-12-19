import { createClient } from '@clickhouse/client';
import { createTestSuite } from '@internal/storage-test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ClickhouseStore } from '.';
import type { ClickhouseConfig } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_CONFIG: ClickhouseConfig = {
  id: 'clickhouse-test',
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
  // ttl: {
  //   mastra_traces: {
  //     row: { interval: 600, unit: 'SECOND' },
  //   },
  // },
};

const storage = new ClickhouseStore(TEST_CONFIG);

createTestSuite(storage);

describe('ClickhouseStore with pre-configured client', () => {
  it('should accept a pre-configured ClickHouse client', () => {
    const client = createClient({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
    });

    const store = new ClickhouseStore({
      id: 'clickhouse-client-test',
      client,
    });

    expect(store).toBeDefined();
  });

  it('should work with pre-configured client for storage operations', async () => {
    const client = createClient({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
      request_timeout: 60000,
    });

    const store = new ClickhouseStore({
      id: 'clickhouse-client-ops-test',
      client,
    });

    await store.init();

    // Test a basic operation
    const thread = {
      id: `thread-client-test-${Date.now()}`,
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

describe('ClickhouseStore Configuration Validation', () => {
  describe('with URL/credentials config', () => {
    it('should throw if url is empty', () => {
      expect(
        () =>
          new ClickhouseStore({
            id: 'test-store',
            url: '',
            username: 'default',
            password: 'password',
          }),
      ).toThrow(/url is required/i);
    });

    it('should accept valid URL/credentials config', () => {
      expect(
        () =>
          new ClickhouseStore({
            id: 'test-store',
            url: 'http://localhost:8123',
            username: 'default',
            password: 'password',
          }),
      ).not.toThrow();
    });

    it('should accept config with TTL options', () => {
      expect(
        () =>
          new ClickhouseStore({
            id: 'test-store',
            url: 'http://localhost:8123',
            username: 'default',
            password: 'password',
            ttl: {
              mastra_traces: {
                row: { interval: 600, unit: 'SECOND' },
              },
            },
          }),
      ).not.toThrow();
    });
  });

  describe('with pre-configured client', () => {
    it('should accept a ClickHouseClient', () => {
      const client = createClient({
        url: 'http://localhost:8123',
        username: 'default',
        password: '',
      });

      expect(
        () =>
          new ClickhouseStore({
            id: 'test-store',
            client,
          }),
      ).not.toThrow();
    });

    it('should accept client with TTL options', () => {
      const client = createClient({
        url: 'http://localhost:8123',
        username: 'default',
        password: '',
      });

      expect(
        () =>
          new ClickhouseStore({
            id: 'test-store',
            client,
            ttl: {
              mastra_traces: {
                row: { interval: 600, unit: 'SECOND' },
              },
            },
          }),
      ).not.toThrow();
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with URL config', () => {
      expect(
        () =>
          new ClickhouseStore({
            id: 'test-store',
            url: 'http://localhost:8123',
            username: 'default',
            password: 'password',
            disableInit: true,
          }),
      ).not.toThrow();
    });

    it('should accept disableInit: true with client config', () => {
      const client = createClient({
        url: 'http://localhost:8123',
        username: 'default',
        password: '',
      });

      expect(
        () =>
          new ClickhouseStore({
            id: 'test-store',
            client,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});

describe('ClickHouse Domain-level Pre-configured Client', () => {
  it('should allow using MemoryStorageClickhouse domain directly with pre-configured client', async () => {
    const client = createClient({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
    });

    // Import and use the domain class directly
    const { MemoryStorageClickhouse } = await import('./domains/memory');

    const memoryDomain = new MemoryStorageClickhouse({ client });

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

  it('should allow using WorkflowsStorageClickhouse domain directly with pre-configured client', async () => {
    const client = createClient({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
    });

    // Import and use the domain class directly
    const { WorkflowsStorageClickhouse } = await import('./domains/workflows');

    const workflowsDomain = new WorkflowsStorageClickhouse({ client });

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

  it('should allow using ScoresStorageClickhouse domain directly with pre-configured client', async () => {
    const client = createClient({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
    });

    // Import and use the domain class directly
    const { ScoresStorageClickhouse } = await import('./domains/scores');

    const scoresDomain = new ScoresStorageClickhouse({ client });

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

  it('should allow domains to accept URL/credentials config directly', async () => {
    // Import and use the domain class directly
    const { MemoryStorageClickhouse } = await import('./domains/memory');

    // Domains can also accept standard URL/credentials config
    const memoryDomain = new MemoryStorageClickhouse({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username || 'default',
      password: TEST_CONFIG.password || '',
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

  it('should allow domains to accept TTL config with pre-configured client', async () => {
    const client = createClient({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
    });

    const { MemoryStorageClickhouse } = await import('./domains/memory');

    // Domains accept TTL config alongside the client
    const memoryDomain = new MemoryStorageClickhouse({
      client,
      ttl: {
        mastra_threads: {
          row: { interval: 30, unit: 'DAY' },
        },
      },
    });

    expect(memoryDomain).toBeDefined();
    await client.close();
  });
});
