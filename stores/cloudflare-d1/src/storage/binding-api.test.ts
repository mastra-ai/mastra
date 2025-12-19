import type { D1Database } from '@cloudflare/workers-types';
import { createTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { describe, expect, it, vi } from 'vitest';
import { MemoryStorageD1 } from './domains/memory';
import { ScoresStorageD1 } from './domains/scores';
import { WorkflowsStorageD1 } from './domains/workflows';
import { D1Store } from '.';
import type { D1Client } from '.';

dotenv.config();

// Increase timeout for all tests in this file
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

/**
 * Helper to test MastraError throws - extracts the underlying error message from cause
 */
const expectMastraError = (fn: () => void, messagePattern: RegExp) => {
  expect(() => {
    try {
      fn();
    } catch (e: any) {
      throw new Error(e.cause?.message || e.message);
    }
  }).toThrow(messagePattern);
};

// Create a Miniflare instance with D1
const mf = new Miniflare({
  modules: true,
  script: 'export default {};',
  d1Databases: { TEST_DB: ':memory:' }, // Use in-memory SQLite for tests
});

// Get the D1 database from Miniflare
const d1Database = await mf.getD1Database('TEST_DB');

createTestSuite(
  new D1Store({
    id: 'd1-test-store',
    binding: d1Database,
    tablePrefix: 'test_',
  }),
);

describe('D1Store with Workers Binding', () => {
  it('should accept a D1 database binding', () => {
    const store = new D1Store({
      id: 'd1-binding-test',
      binding: d1Database,
      tablePrefix: 'test_prefix_',
    });

    expect(store).toBeDefined();
    expect(store.name).toBe('D1');
  });

  it('should work with binding for storage operations', async () => {
    const store = new D1Store({
      id: 'd1-binding-ops-test',
      binding: d1Database,
      tablePrefix: `test_ops_${Date.now()}_`,
    });

    await store.init();

    // Test a basic operation
    const thread = {
      id: `thread-binding-test-${Date.now()}`,
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
  });
});

describe('D1Store with pre-configured client', () => {
  // Create a D1Client from the Miniflare binding
  const createD1Client = (binding: D1Database): D1Client => ({
    query: async ({ sql, params }) => {
      const stmt = binding.prepare(sql);
      const result = await stmt.bind(...params).all();
      return { result: [result] as any };
    },
  });

  it('should accept a pre-configured D1Client', () => {
    const client = createD1Client(d1Database);

    const store = new D1Store({
      id: 'd1-client-test',
      client,
      tablePrefix: 'client_test_',
    });

    expect(store).toBeDefined();
    expect(store.name).toBe('D1');
  });

  it('should work with pre-configured client for storage operations', async () => {
    const client = createD1Client(d1Database);

    const store = new D1Store({
      id: 'd1-client-ops-test',
      client,
      tablePrefix: `client_ops_${Date.now()}_`,
    });

    await store.init();

    // Test a basic operation
    const thread = {
      id: `thread-client-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test Thread from Client',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await store.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    const retrievedThread = await store.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toBeDefined();
    expect(retrievedThread?.title).toBe('Test Thread from Client');

    // Clean up
    await store.deleteThread({ threadId: thread.id });
  });
});

describe('D1 Domain-level Pre-configured Client', () => {
  it('should allow using MemoryStorageD1 domain directly with binding', async () => {
    const memoryDomain = new MemoryStorageD1({
      binding: d1Database,
      tablePrefix: `test_memory_domain_${Date.now()}_`,
    });

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
  });

  it('should allow using WorkflowsStorageD1 domain directly with binding', async () => {
    const workflowsDomain = new WorkflowsStorageD1({
      binding: d1Database,
      tablePrefix: `test_workflows_domain_${Date.now()}_`,
    });

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
  });

  it('should allow using ScoresStorageD1 domain directly with binding', async () => {
    const scoresDomain = new ScoresStorageD1({
      binding: d1Database,
      tablePrefix: `test_scores_domain_${Date.now()}_`,
    });

    expect(scoresDomain).toBeDefined();
    await scoresDomain.init();

    // Test a basic operation
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
  });
});

describe('D1Store Configuration Validation', () => {
  describe('with Workers Binding config', () => {
    it('should accept valid binding config', () => {
      expect(
        () =>
          new D1Store({
            id: 'test-store',
            binding: d1Database,
          }),
      ).not.toThrow();
    });

    it('should accept binding with tablePrefix', () => {
      expect(
        () =>
          new D1Store({
            id: 'test-store',
            binding: d1Database,
            tablePrefix: 'custom_prefix_',
          }),
      ).not.toThrow();
    });

    it('should throw if binding is falsy', () => {
      expectMastraError(() => new D1Store({ id: 'test-store', binding: null as any }), /D1 binding is required/);
    });
  });

  describe('with pre-configured client', () => {
    it('should accept a D1Client', () => {
      const client: D1Client = {
        query: async () => ({ result: [] }),
      };

      expect(
        () =>
          new D1Store({
            id: 'test-store',
            client,
          }),
      ).not.toThrow();
    });

    it('should throw if client is falsy', () => {
      expectMastraError(() => new D1Store({ id: 'test-store', client: null as any }), /D1 client is required/);
    });
  });

  describe('with REST API config', () => {
    it('should throw if accountId is missing', () => {
      expectMastraError(
        () =>
          new D1Store({
            id: 'test-store',
            accountId: '',
            apiToken: 'test-token',
            databaseId: 'test-db',
          } as any),
        /accountId, databaseId, and apiToken are required/,
      );
    });

    it('should throw if apiToken is missing', () => {
      expectMastraError(
        () =>
          new D1Store({
            id: 'test-store',
            accountId: 'test-account',
            apiToken: '',
            databaseId: 'test-db',
          } as any),
        /accountId, databaseId, and apiToken are required/,
      );
    });

    it('should throw if databaseId is missing', () => {
      expectMastraError(
        () =>
          new D1Store({
            id: 'test-store',
            accountId: 'test-account',
            apiToken: 'test-token',
            databaseId: '',
          } as any),
        /accountId, databaseId, and apiToken are required/,
      );
    });

    it('should accept valid REST API config', () => {
      expect(
        () =>
          new D1Store({
            id: 'test-store',
            accountId: 'test-account',
            apiToken: 'test-token',
            databaseId: 'test-db',
          } as any),
      ).not.toThrow();
    });
  });

  describe('tablePrefix validation', () => {
    it('should accept valid tablePrefix with letters, numbers, and underscores', () => {
      expect(
        () =>
          new D1Store({
            id: 'test-store',
            binding: d1Database,
            tablePrefix: 'valid_prefix_123',
          }),
      ).not.toThrow();
    });

    it('should throw for invalid tablePrefix with special characters', () => {
      expectMastraError(
        () =>
          new D1Store({
            id: 'test-store',
            binding: d1Database,
            tablePrefix: 'invalid-prefix!',
          }),
        /Invalid tablePrefix/,
      );
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with binding config', () => {
      expect(
        () =>
          new D1Store({
            id: 'test-store',
            binding: d1Database,
            disableInit: true,
          }),
      ).not.toThrow();
    });

    it('should accept disableInit: true with client config', () => {
      const client: D1Client = {
        query: async () => ({ result: [] }),
      };

      expect(
        () =>
          new D1Store({
            id: 'test-store',
            client,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});
