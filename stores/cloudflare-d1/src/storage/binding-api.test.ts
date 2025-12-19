import type { D1Database } from '@cloudflare/workers-types';
import { createTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { describe, expect, it, vi } from 'vitest';
import type { D1Client } from '.';
import { D1Store } from '.';

dotenv.config();

// Increase timeout for all tests in this file
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

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
      expect(() => {
        try {
          new D1Store({
            id: 'test-store',
            binding: null as any,
          });
        } catch (e: any) {
          // MastraError wraps the original error in cause
          throw new Error(e.cause?.message || e.message);
        }
      }).toThrow(/D1 binding is required/);
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
      expect(() => {
        try {
          new D1Store({
            id: 'test-store',
            client: null as any,
          });
        } catch (e: any) {
          throw new Error(e.cause?.message || e.message);
        }
      }).toThrow(/D1 client is required/);
    });
  });

  describe('with REST API config', () => {
    it('should throw if accountId is missing', () => {
      expect(() => {
        try {
          new D1Store({
            id: 'test-store',
            accountId: '',
            apiToken: 'test-token',
            databaseId: 'test-db',
          } as any);
        } catch (e: any) {
          throw new Error(e.cause?.message || e.message);
        }
      }).toThrow(/accountId, databaseId, and apiToken are required/);
    });

    it('should throw if apiToken is missing', () => {
      expect(() => {
        try {
          new D1Store({
            id: 'test-store',
            accountId: 'test-account',
            apiToken: '',
            databaseId: 'test-db',
          } as any);
        } catch (e: any) {
          throw new Error(e.cause?.message || e.message);
        }
      }).toThrow(/accountId, databaseId, and apiToken are required/);
    });

    it('should throw if databaseId is missing', () => {
      expect(() => {
        try {
          new D1Store({
            id: 'test-store',
            accountId: 'test-account',
            apiToken: 'test-token',
            databaseId: '',
          } as any);
        } catch (e: any) {
          throw new Error(e.cause?.message || e.message);
        }
      }).toThrow(/accountId, databaseId, and apiToken are required/);
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
      expect(() => {
        try {
          new D1Store({
            id: 'test-store',
            binding: d1Database,
            tablePrefix: 'invalid-prefix!',
          });
        } catch (e: any) {
          throw new Error(e.cause?.message || e.message);
        }
      }).toThrow(/Invalid tablePrefix/);
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
