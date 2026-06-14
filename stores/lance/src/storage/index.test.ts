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

describe('StoreMemoryLance error propagation (no empty-on-error)', () => {
  // These reads used to swallow DB errors and return an empty page, so an outage
  // looked exactly like "no data". They should throw instead.
  const createFailingDomain = () => {
    const client = { openTable: vi.fn().mockRejectedValue(new Error('simulated backend outage')) };
    return new StoreMemoryLance({ client: client as any });
  };

  // Also check the cause is the original error, so a broken mock can't pass as
  // a real outage.
  const expectOutage = async (promise: Promise<unknown>, idPattern: RegExp) => {
    const err: any = await promise.then(
      () => {
        throw new Error('expected the read to reject, but it resolved');
      },
      e => e,
    );
    expect(err).toMatchObject({ id: expect.stringMatching(idPattern) });
    expect(String(err?.cause?.message ?? err?.message)).toContain('simulated backend outage');
  };

  it('listThreads re-throws backend failures instead of returning empty', async () => {
    await expectOutage(createFailingDomain().listThreads({}), /LIST_THREADS.*FAILED/);
  });

  it('listMessages re-throws backend failures instead of returning empty', async () => {
    await expectOutage(createFailingDomain().listMessages({ threadId: 'thread-err' }), /LIST_MESSAGES.*FAILED/);
  });
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
