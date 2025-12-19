import { createTestSuite } from '@internal/storage-test-utils';
import { Redis } from '@upstash/redis';
import { describe, expect, it, vi } from 'vitest';

import { StoreMemoryUpstash } from './domains/memory';
import { StoreScoresUpstash } from './domains/scores';
import { StoreWorkflowsUpstash } from './domains/workflows';
import { UpstashStore } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const TEST_CONFIG = {
  url: 'http://localhost:8079',
  token: 'test_token',
};

createTestSuite(
  new UpstashStore({
    id: 'upstash-test-store',
    ...TEST_CONFIG,
  }),
);

describe('UpstashStore with pre-configured client', () => {
  it('should accept a pre-configured Redis client', () => {
    const client = new Redis({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    const store = new UpstashStore({
      id: 'upstash-client-test',
      client,
    });

    expect(store).toBeDefined();
    expect(store.name).toBe('Upstash');
  });

  it('should work with pre-configured client for storage operations', async () => {
    const client = new Redis({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    const store = new UpstashStore({
      id: 'upstash-client-ops-test',
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
});

describe('UpstashStore Configuration Validation', () => {
  describe('with URL/token config', () => {
    it('should throw if url is empty', () => {
      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            url: '',
            token: 'test-token',
          }),
      ).toThrow(/url is required/i);
    });

    it('should throw if token is empty', () => {
      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            url: 'http://localhost:8079',
            token: '',
          }),
      ).toThrow(/token is required/i);
    });

    it('should accept valid URL/token config', () => {
      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            url: 'http://localhost:8079',
            token: 'test-token',
          }),
      ).not.toThrow();
    });
  });

  describe('with pre-configured client', () => {
    it('should accept a Redis client', () => {
      const client = new Redis({
        url: 'http://localhost:8079',
        token: 'test-token',
      });

      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            client,
          }),
      ).not.toThrow();
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with URL config', () => {
      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            url: 'http://localhost:8079',
            token: 'test-token',
            disableInit: true,
          }),
      ).not.toThrow();
    });

    it('should accept disableInit: true with client config', () => {
      const client = new Redis({
        url: 'http://localhost:8079',
        token: 'test-token',
      });

      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            client,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});

describe('Upstash Domain-level Pre-configured Client', () => {
  it('should allow using StoreMemoryUpstash domain directly with pre-configured client', async () => {
    const client = new Redis({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    const memoryDomain = new StoreMemoryUpstash({ client });

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

  it('should allow using StoreWorkflowsUpstash domain directly with pre-configured client', async () => {
    const client = new Redis({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    const workflowsDomain = new StoreWorkflowsUpstash({ client });

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

  it('should allow using StoreScoresUpstash domain directly with pre-configured client', async () => {
    const client = new Redis({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    const scoresDomain = new StoreScoresUpstash({ client });

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

  it('should allow domains to use url/token config directly', async () => {
    const memoryDomain = new StoreMemoryUpstash({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
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
