import { createTestSuite } from '@internal/storage-test-utils';
import { connect } from '@lancedb/lancedb';
import { afterAll, describe, expect, it, vi } from 'vitest';
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
      const fs = await import('node:fs/promises');
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
      const fs = await import('node:fs/promises');
      await fs.rm('test-validation-db', { recursive: true, force: true });
    });

    it('should accept connectionOptions', async () => {
      const store = await LanceStorage.create('lance-conn-opts-test', 'LanceConnOptsTest', 'test-conn-opts-db', {
        // LanceDB connection options can be passed here
      });
      expect(store).toBeDefined();

      // Clean up
      const fs = await import('node:fs/promises');
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
      const fs = await import('node:fs/promises');
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
      const fs = await import('node:fs/promises');
      await fs.rm('test-from-client-db', { recursive: true, force: true });
    });

    it('should accept options parameter', async () => {
      const client = await connect('test-from-client-opts-db');
      const store = LanceStorage.fromClient('lance-from-client-opts-test', 'LanceFromClientOptsTest', client, {
        disableInit: true,
      });

      expect(store).toBeDefined();

      // Clean up
      const fs = await import('node:fs/promises');
      await fs.rm('test-from-client-opts-db', { recursive: true, force: true });
    });
  });
});
