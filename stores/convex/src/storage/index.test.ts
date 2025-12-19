import { createTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { describe, expect, it, vi } from 'vitest';

import { ConvexAdminClient } from './client';
import { MemoryConvex } from './domains/memory';
import { ScoresConvex } from './domains/scores';
import { WorkflowsConvex } from './domains/workflows';
import { ConvexStore } from './index';

dotenv.config();

vi.setConfig({
  testTimeout: 180_000,
  hookTimeout: 180_000,
});

const deploymentUrl = process.env.CONVEX_TEST_URL;
const adminKey = process.env.CONVEX_TEST_ADMIN_KEY;
const storageFunction = process.env.CONVEX_TEST_STORAGE_FUNCTION;

if (!deploymentUrl || !adminKey) {
  describe.skip('ConvexStore', () => {
    it('requires CONVEX_TEST_URL and CONVEX_TEST_ADMIN_KEY to run integration tests', () => undefined);
  });
} else {
  const store = new ConvexStore({
    id: `convex-store-test`,
    deploymentUrl,
    adminAuthToken: adminKey,
    ...(storageFunction ? { storageFunction } : {}),
  });

  createTestSuite(store);

  describe('ConvexStore with pre-configured client', () => {
    it('should accept a pre-configured ConvexAdminClient', () => {
      const client = new ConvexAdminClient({
        deploymentUrl,
        adminAuthToken: adminKey,
        ...(storageFunction ? { storageFunction } : {}),
      });

      const clientStore = new ConvexStore({
        id: 'convex-client-test',
        client,
      });

      expect(clientStore).toBeDefined();
      expect(clientStore.name).toBe('ConvexStore');
    });

    it('should work with pre-configured client for storage operations', async () => {
      const client = new ConvexAdminClient({
        deploymentUrl,
        adminAuthToken: adminKey,
        ...(storageFunction ? { storageFunction } : {}),
      });

      const clientStore = new ConvexStore({
        id: 'convex-client-ops-test',
        name: 'ConvexClientOpsTest',
        client,
      });

      await clientStore.init();

      // Test a basic operation
      const thread = {
        id: `thread-client-test-${Date.now()}`,
        resourceId: 'test-resource',
        title: 'Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedThread = await clientStore.saveThread({ thread });
      expect(savedThread.id).toBe(thread.id);

      const retrievedThread = await clientStore.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeDefined();
      expect(retrievedThread?.title).toBe('Test Thread');

      // Clean up
      await clientStore.deleteThread({ threadId: thread.id });
    });
  });

  describe('Convex Domain-level Pre-configured Client', () => {
    it('should allow using MemoryConvex domain directly with pre-configured client', async () => {
      const client = new ConvexAdminClient({
        deploymentUrl,
        adminAuthToken: adminKey,
        ...(storageFunction ? { storageFunction } : {}),
      });

      const memoryDomain = new MemoryConvex({ client });

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

    it('should allow using WorkflowsConvex domain directly with pre-configured client', async () => {
      const client = new ConvexAdminClient({
        deploymentUrl,
        adminAuthToken: adminKey,
        ...(storageFunction ? { storageFunction } : {}),
      });

      const workflowsDomain = new WorkflowsConvex({ client });

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

    it('should allow using ScoresConvex domain directly with pre-configured client', async () => {
      const client = new ConvexAdminClient({
        deploymentUrl,
        adminAuthToken: adminKey,
        ...(storageFunction ? { storageFunction } : {}),
      });

      const scoresDomain = new ScoresConvex({ client });

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

    it('should allow domains to use deployment config directly', async () => {
      const memoryDomain = new MemoryConvex({
        deploymentUrl,
        adminAuthToken: adminKey,
        ...(storageFunction ? { storageFunction } : {}),
      });

      expect(memoryDomain).toBeDefined();
      await memoryDomain.init();

      // Test a basic operation to verify it works
      const thread = {
        id: `thread-config-test-${Date.now()}`,
        resourceId: 'test-resource',
        title: 'Test Config Thread',
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
}

// Configuration validation tests (run even without credentials)
describe('ConvexStore Configuration Validation', () => {
  describe('with deployment config', () => {
    it('should throw if deploymentUrl is empty', () => {
      expect(
        () =>
          new ConvexStore({
            id: 'test-store',
            deploymentUrl: '',
            adminAuthToken: 'test-token',
          }),
      ).toThrow(/deploymentUrl is required/);
    });

    it('should throw if adminAuthToken is empty', () => {
      expect(
        () =>
          new ConvexStore({
            id: 'test-store',
            deploymentUrl: 'https://test.convex.cloud',
            adminAuthToken: '',
          }),
      ).toThrow(/adminAuthToken is required/);
    });

    it('should accept valid deployment config', () => {
      expect(
        () =>
          new ConvexStore({
            id: 'test-store',
            deploymentUrl: 'https://test.convex.cloud',
            adminAuthToken: 'test-token',
          }),
      ).not.toThrow();
    });

    it('should accept optional storageFunction', () => {
      expect(
        () =>
          new ConvexStore({
            id: 'test-store',
            deploymentUrl: 'https://test.convex.cloud',
            adminAuthToken: 'test-token',
            storageFunction: 'custom/storage:handle',
          }),
      ).not.toThrow();
    });
  });

  describe('with pre-configured client', () => {
    it('should accept a ConvexAdminClient', () => {
      const client = new ConvexAdminClient({
        deploymentUrl: 'https://test.convex.cloud',
        adminAuthToken: 'test-token',
      });

      expect(
        () =>
          new ConvexStore({
            id: 'test-store',
            client,
          }),
      ).not.toThrow();
    });

    it('should accept client with custom name', () => {
      const client = new ConvexAdminClient({
        deploymentUrl: 'https://test.convex.cloud',
        adminAuthToken: 'test-token',
      });

      const store = new ConvexStore({
        id: 'test-store',
        name: 'CustomConvexStore',
        client,
      });

      expect(store.name).toBe('CustomConvexStore');
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with deployment config', () => {
      expect(
        () =>
          new ConvexStore({
            id: 'test-store',
            deploymentUrl: 'https://test.convex.cloud',
            adminAuthToken: 'test-token',
            disableInit: true,
          }),
      ).not.toThrow();
    });

    it('should accept disableInit: true with client config', () => {
      const client = new ConvexAdminClient({
        deploymentUrl: 'https://test.convex.cloud',
        adminAuthToken: 'test-token',
      });

      expect(
        () =>
          new ConvexStore({
            id: 'test-store',
            client,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});
