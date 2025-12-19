import fs from 'node:fs/promises';
import { createTestSuite } from '@internal/storage-test-utils';
import { connect } from '@lancedb/lancedb';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { StoreMemoryLance } from './domains/memory';
import { StoreScoresLance } from './domains/scores';
import { StoreWorkflowsLance } from './domains/workflows';
import { LanceStorage } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const storage = await LanceStorage.create('lance-test-storage', 'LanceTestStorage', 'test');

createTestSuite(storage);

describe('LanceStorage with pre-configured client', () => {
  let clientStorage: LanceStorage;

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm('test-client-db', { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should accept a pre-configured LanceDB connection via fromClient()', async () => {
    const client = await connect('test-client-db');

    clientStorage = LanceStorage.fromClient('lance-client-test', 'LanceClientTest', client);

    expect(clientStorage).toBeDefined();
    expect(clientStorage.name).toBe('LanceClientTest');
  });

  it('should work with pre-configured client for storage operations', async () => {
    const client = await connect('test-client-db');

    const store = LanceStorage.fromClient('lance-client-ops-test', 'LanceClientOpsTest', client);
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

  it('should accept disableInit option with fromClient()', async () => {
    const client = await connect('test-client-db');

    const store = LanceStorage.fromClient('lance-disable-init-test', 'LanceDisableInitTest', client, {
      disableInit: true,
    });

    expect(store).toBeDefined();
  });
});

describe('LanceStorage Configuration Validation', () => {
  describe('create() factory method', () => {
    it('should create storage with uri path', async () => {
      const store = await LanceStorage.create('lance-uri-test', 'LanceUriTest', 'test-validation-db');
      expect(store).toBeDefined();

      // Clean up
      await fs.rm('test-validation-db', { recursive: true, force: true });
    });

    it('should accept connectionOptions', async () => {
      const store = await LanceStorage.create('lance-conn-opts-test', 'LanceConnOptsTest', 'test-conn-opts-db', {
        // LanceDB connection options can be passed here
      });
      expect(store).toBeDefined();

      // Clean up
      await fs.rm('test-conn-opts-db', { recursive: true, force: true });
    });

    it('should accept storageOptions with disableInit', async () => {
      const store = await LanceStorage.create(
        'lance-storage-opts-test',
        'LanceStorageOptsTest',
        'test-storage-opts-db',
        undefined,
        { disableInit: true },
      );
      expect(store).toBeDefined();

      // Clean up
      await fs.rm('test-storage-opts-db', { recursive: true, force: true });
    });
  });

  describe('fromClient() factory method', () => {
    it('should create storage from pre-configured client', async () => {
      const client = await connect('test-from-client-db');
      const store = LanceStorage.fromClient('lance-from-client-test', 'LanceFromClientTest', client);

      expect(store).toBeDefined();
      expect(store.name).toBe('LanceFromClientTest');

      // Clean up
      await fs.rm('test-from-client-db', { recursive: true, force: true });
    });

    it('should accept options parameter', async () => {
      const client = await connect('test-from-client-opts-db');
      const store = LanceStorage.fromClient('lance-from-client-opts-test', 'LanceFromClientOptsTest', client, {
        disableInit: true,
      });

      expect(store).toBeDefined();

      // Clean up
      await fs.rm('test-from-client-opts-db', { recursive: true, force: true });
    });
  });
});

describe('Lance Domain-level Pre-configured Client', () => {
  afterAll(async () => {
    // Clean up test directories
    try {
      await fs.rm('test-domain-memory-db', { recursive: true, force: true });
      await fs.rm('test-domain-workflows-db', { recursive: true, force: true });
      await fs.rm('test-domain-scores-db', { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should allow using StoreMemoryLance domain directly with pre-configured client', async () => {
    const client = await connect('test-domain-memory-db');

    const memoryDomain = new StoreMemoryLance({ client });

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

  it('should allow using StoreWorkflowsLance domain directly with pre-configured client', async () => {
    const client = await connect('test-domain-workflows-db');

    const workflowsDomain = new StoreWorkflowsLance({ client });

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

  it('should allow using StoreScoresLance domain directly with pre-configured client', async () => {
    const client = await connect('test-domain-scores-db');

    const scoresDomain = new StoreScoresLance({ client });

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
