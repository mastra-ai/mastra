import fs from 'node:fs/promises';
import { createTestSuite, createClientAcceptanceTests, createDomainDirectTests } from '@internal/storage-test-utils';
import { connect } from '@lancedb/lancedb';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { StoreMemoryLance } from './domains/memory';
import { StoreScoresLance } from './domains/scores';
import { StoreWorkflowsLance } from './domains/workflows';
import { LanceStorage } from './index';

vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

// Create clients at top level (async) so we can use them in sync factory functions
const storage = await LanceStorage.create('lance-test-storage', 'LanceTestStorage', 'test');
const testClient = await connect('test-factory-db');

createTestSuite(storage);

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'LanceStorage',
  expectedStoreName: 'LanceClientTest',
  createStoreWithClient: () => LanceStorage.fromClient('lance-client-test', 'LanceClientTest', testClient),
  createStoreWithClientAndOptions: () =>
    LanceStorage.fromClient('lance-client-opts-test', 'LanceClientOptsTest', testClient, { disableInit: true }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'Lance',
  createMemoryDomain: () => new StoreMemoryLance({ client: testClient }),
  createWorkflowsDomain: () => new StoreWorkflowsLance({ client: testClient }),
  createScoresDomain: () => new StoreScoresLance({ client: testClient }),
});

// LanceStorage uses async factory methods (create/fromClient), so we test configuration manually
describe('LanceStorage Configuration Validation', () => {
  afterAll(async () => {
    // Clean up test directories
    const dirs = [
      'test-factory-db',
      'test-validation-db',
      'test-conn-opts-db',
      'test-storage-opts-db',
      'test-from-client-db',
      'test-from-client-opts-db',
    ];
    for (const dir of dirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('create() factory method', () => {
    it('should create storage with uri path', async () => {
      const store = await LanceStorage.create('lance-uri-test', 'LanceUriTest', 'test-validation-db');
      expect(store).toBeDefined();
    });

    it('should accept connectionOptions', async () => {
      const store = await LanceStorage.create('lance-conn-opts-test', 'LanceConnOptsTest', 'test-conn-opts-db', {});
      expect(store).toBeDefined();
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
    });
  });

  describe('fromClient() factory method', () => {
    it('should create storage from pre-configured client', async () => {
      const client = await connect('test-from-client-db');
      const store = LanceStorage.fromClient('lance-from-client-test', 'LanceFromClientTest', client);

      expect(store).toBeDefined();
      expect(store.name).toBe('LanceFromClientTest');
    });

    it('should accept options parameter', async () => {
      const client = await connect('test-from-client-opts-db');
      const store = LanceStorage.fromClient('lance-from-client-opts-test', 'LanceFromClientOptsTest', client, {
        disableInit: true,
      });

      expect(store).toBeDefined();
    });
  });
});
