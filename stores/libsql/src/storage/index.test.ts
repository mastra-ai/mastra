import { createTestSuite } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_DB_URL = 'file::memory:?cache=shared';

const libsql = new LibSQLStore({
  id: 'libsql-test-store',
  url: TEST_DB_URL,
});

const mastra = new Mastra({
  storage: libsql,
});

createTestSuite(mastra.getStorage()!);

describe('LibSQLStore with pre-configured client', () => {
  it('should accept a pre-configured libsql Client', () => {
    const client = createClient({ url: TEST_DB_URL });

    const store = new LibSQLStore({
      id: 'libsql-client-test',
      client,
    });

    expect(store).toBeDefined();
    expect(store.name).toBe('LibSQLStore');
  });

  it('should work with pre-configured client for storage operations', async () => {
    const client = createClient({ url: 'file::memory:?cache=shared' });

    const store = new LibSQLStore({
      id: 'libsql-client-ops-test',
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
  });

  it('should accept client with retry options', () => {
    const client = createClient({ url: TEST_DB_URL });

    const store = new LibSQLStore({
      id: 'libsql-client-retry-test',
      client,
      maxRetries: 10,
      initialBackoffMs: 200,
    });

    expect(store).toBeDefined();
  });
});

describe('LibSQLStore Configuration Validation', () => {
  describe('with URL config', () => {
    it('should throw if id is empty', () => {
      expect(
        () =>
          new LibSQLStore({
            id: '',
            url: TEST_DB_URL,
          }),
      ).toThrow(/id must be provided/i);
    });

    it('should accept valid URL config', () => {
      expect(
        () =>
          new LibSQLStore({
            id: 'test-store',
            url: TEST_DB_URL,
          }),
      ).not.toThrow();
    });

    it('should accept URL config with authToken', () => {
      expect(
        () =>
          new LibSQLStore({
            id: 'test-store',
            url: 'libsql://my-db.turso.io',
            authToken: 'test-token',
          }),
      ).not.toThrow();
    });

    it('should accept URL config with retry options', () => {
      expect(
        () =>
          new LibSQLStore({
            id: 'test-store',
            url: TEST_DB_URL,
            maxRetries: 10,
            initialBackoffMs: 200,
          }),
      ).not.toThrow();
    });
  });

  describe('with pre-configured client', () => {
    it('should accept a Client', () => {
      const client = createClient({ url: TEST_DB_URL });

      expect(
        () =>
          new LibSQLStore({
            id: 'test-store',
            client,
          }),
      ).not.toThrow();
    });

    it('should accept client with retry options', () => {
      const client = createClient({ url: TEST_DB_URL });

      expect(
        () =>
          new LibSQLStore({
            id: 'test-store',
            client,
            maxRetries: 10,
            initialBackoffMs: 200,
          }),
      ).not.toThrow();
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with URL config', () => {
      expect(
        () =>
          new LibSQLStore({
            id: 'test-store',
            url: TEST_DB_URL,
            disableInit: true,
          }),
      ).not.toThrow();
    });

    it('should accept disableInit: true with client config', () => {
      const client = createClient({ url: TEST_DB_URL });

      expect(
        () =>
          new LibSQLStore({
            id: 'test-store',
            client,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});

describe('LibSQL Domain-level Pre-configured Client', () => {
  it('should allow using MemoryLibSQL domain directly with pre-configured client', async () => {
    const client = createClient({ url: TEST_DB_URL });

    // Import and use the domain class directly
    const { MemoryLibSQL } = await import('./domains/memory');

    const memoryDomain = new MemoryLibSQL({ client });

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

  it('should allow using WorkflowsLibSQL domain directly with pre-configured client', async () => {
    const client = createClient({ url: TEST_DB_URL });

    // Import and use the domain class directly
    const { WorkflowsLibSQL } = await import('./domains/workflows');

    const workflowsDomain = new WorkflowsLibSQL({ client });

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

  it('should allow using ScoresLibSQL domain directly with pre-configured client', async () => {
    const client = createClient({ url: TEST_DB_URL });

    // Import and use the domain class directly
    const { ScoresLibSQL } = await import('./domains/scores');

    const scoresDomain = new ScoresLibSQL({ client });

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
  });

  it('should allow domains to accept retry options with pre-configured client', async () => {
    const client = createClient({ url: TEST_DB_URL });

    const { MemoryLibSQL } = await import('./domains/memory');

    // Domains accept retry options alongside the client
    const memoryDomain = new MemoryLibSQL({
      client,
      maxRetries: 10,
      initialBackoffMs: 200,
    });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    // Test a basic operation to verify it works
    const thread = {
      id: `thread-retry-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test Retry Thread',
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
