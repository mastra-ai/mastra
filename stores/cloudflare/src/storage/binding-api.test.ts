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
