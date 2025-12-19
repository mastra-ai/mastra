import type { KVNamespace } from '@cloudflare/workers-types';
import { createTestSuite } from '@internal/storage-test-utils';
import {
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { describe, expect, it, vi } from 'vitest';

import { MemoryStorageCloudflare } from './domains/memory';
import { ScoresStorageCloudflare } from './domains/scores';
import { WorkflowsStorageCloudflare } from './domains/workflows';
import type { CloudflareWorkersConfig } from './types';
import { CloudflareStore } from '.';

export interface Env {
  [TABLE_THREADS]: KVNamespace;
  [TABLE_MESSAGES]: KVNamespace;
  [TABLE_WORKFLOW_SNAPSHOT]: KVNamespace;
  [TABLE_TRACES]: KVNamespace;
  [TABLE_SCORERS]: KVNamespace;
  [TABLE_RESOURCES]: KVNamespace;
}

dotenv.config();

// Increase timeout for namespace creation and cleanup
vi.setConfig({ testTimeout: 80000, hookTimeout: 80000 });

// Initialize Miniflare with minimal worker
const mf = new Miniflare({
  script: 'export default {};',
  modules: true,
  kvNamespaces: [TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_TRACES, TABLE_RESOURCES, TABLE_SCORERS],
});

const TEST_CONFIG: CloudflareWorkersConfig = {
  id: 'cloudflare-binding-test',
  bindings: {} as Env, // Will be populated in beforeAll
  keyPrefix: 'mastra-test', // Fixed prefix for test isolation
};

// Get KV namespaces from Miniflare
const kvBindings = {
  [TABLE_THREADS]: (await mf.getKVNamespace(TABLE_THREADS)) as KVNamespace,
  [TABLE_MESSAGES]: (await mf.getKVNamespace(TABLE_MESSAGES)) as KVNamespace,
  [TABLE_WORKFLOW_SNAPSHOT]: (await mf.getKVNamespace(TABLE_WORKFLOW_SNAPSHOT)) as KVNamespace,
  [TABLE_TRACES]: (await mf.getKVNamespace(TABLE_TRACES)) as KVNamespace,
  [TABLE_RESOURCES]: (await mf.getKVNamespace(TABLE_RESOURCES)) as KVNamespace,
  [TABLE_SCORERS]: (await mf.getKVNamespace(TABLE_SCORERS)) as KVNamespace,
};

// Set bindings in test config
TEST_CONFIG.bindings = kvBindings;

createTestSuite(new CloudflareStore(TEST_CONFIG));

describe('CloudflareStore with Workers Bindings', () => {
  it('should accept KV namespace bindings', () => {
    const store = new CloudflareStore({
      id: 'cloudflare-bindings-test',
      bindings: kvBindings,
      keyPrefix: 'test-prefix',
    });

    expect(store).toBeDefined();
    expect(store.name).toBe('Cloudflare');
  });

  it('should work with bindings for storage operations', async () => {
    const store = new CloudflareStore({
      id: 'cloudflare-bindings-ops-test',
      bindings: kvBindings,
      keyPrefix: `test-ops-${Date.now()}`,
    });

    await store.init();

    // Test a basic operation
    const thread = {
      id: `thread-bindings-test-${Date.now()}`,
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

describe('Cloudflare Domain-level Pre-configured Client', () => {
  it('should allow using MemoryStorageCloudflare domain directly with bindings', async () => {
    const memoryDomain = new MemoryStorageCloudflare({
      bindings: kvBindings,
      keyPrefix: `test-memory-domain-${Date.now()}`,
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

  it('should allow using WorkflowsStorageCloudflare domain directly with bindings', async () => {
    const workflowsDomain = new WorkflowsStorageCloudflare({
      bindings: kvBindings,
      keyPrefix: `test-workflows-domain-${Date.now()}`,
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

  it('should allow using ScoresStorageCloudflare domain directly with bindings', async () => {
    const scoresDomain = new ScoresStorageCloudflare({
      bindings: kvBindings,
      keyPrefix: `test-scores-domain-${Date.now()}`,
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

describe('CloudflareStore Configuration Validation', () => {
  describe('with Workers Binding config', () => {
    it('should accept valid bindings config', () => {
      expect(
        () =>
          new CloudflareStore({
            id: 'test-store',
            bindings: kvBindings,
          }),
      ).not.toThrow();
    });

    it('should accept bindings with keyPrefix', () => {
      expect(
        () =>
          new CloudflareStore({
            id: 'test-store',
            bindings: kvBindings,
            keyPrefix: 'custom-prefix',
          }),
      ).not.toThrow();
    });

    it('should throw if bindings is missing required tables', () => {
      const incompleteBindings = {
        [TABLE_THREADS]: kvBindings[TABLE_THREADS],
        // Missing other required tables
      };

      expect(
        () =>
          new CloudflareStore({
            id: 'test-store',
            bindings: incompleteBindings as any,
          }),
      ).toThrow(/Missing KV binding/);
    });
  });

  describe('with REST API config', () => {
    it('should throw if accountId is empty', () => {
      expect(
        () =>
          new CloudflareStore({
            id: 'test-store',
            accountId: '',
            apiToken: 'test-token',
          } as any),
      ).toThrow(/accountId is required/);
    });

    it('should throw if apiToken is empty', () => {
      expect(
        () =>
          new CloudflareStore({
            id: 'test-store',
            accountId: 'test-account',
            apiToken: '',
          } as any),
      ).toThrow(/apiToken is required/);
    });

    it('should accept valid REST API config', () => {
      expect(
        () =>
          new CloudflareStore({
            id: 'test-store',
            accountId: 'test-account',
            apiToken: 'test-token',
          } as any),
      ).not.toThrow();
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with bindings config', () => {
      expect(
        () =>
          new CloudflareStore({
            id: 'test-store',
            bindings: kvBindings,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});
