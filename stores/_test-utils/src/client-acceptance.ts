import { describe, it, expect } from 'vitest';

/**
 * Thread data structure for testing
 */
export interface ThreadData {
  id: string;
  resourceId: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuration for the client acceptance test factory
 */
export interface ClientAcceptanceTestConfig {
  /** Name of the store being tested */
  storeName: string;

  /** Expected value of store.name property */
  expectedStoreName: string;

  /** Factory to create a store with a pre-configured client */
  createStoreWithClient: () => {
    name?: string;
    init(): Promise<void>;
    saveThread(params: { thread: ThreadData }): Promise<{ id: string; title?: string }>;
    getThreadById(params: { threadId: string }): Promise<{ id: string; title?: string } | null>;
    deleteThread(params: { threadId: string }): Promise<void>;
  };

  /**
   * Optional: Factory to create a store with client and additional options.
   * Use this to test that stores accept extra options alongside the client.
   */
  createStoreWithClientAndOptions?: () => unknown;
}

/**
 * Creates tests that verify a storage adapter accepts pre-configured clients.
 *
 * This factory generates tests that verify:
 * - The store can be instantiated with a pre-configured client
 * - The store's name property is set correctly
 * - Basic storage operations work with the pre-configured client
 * - Additional options can be passed alongside the client (if applicable)
 *
 * @example
 * ```typescript
 * createClientAcceptanceTests({
 *   storeName: 'LibSQLStore',
 *   expectedStoreName: 'LibSQLStore',
 *   createStoreWithClient: () => new LibSQLStore({
 *     id: 'test',
 *     client: createClient({ url: 'file::memory:' }),
 *   }),
 *   createStoreWithClientAndOptions: () => new LibSQLStore({
 *     id: 'test',
 *     client: createClient({ url: 'file::memory:' }),
 *     maxRetries: 10,
 *   }),
 * });
 * ```
 */
export function createClientAcceptanceTests(config: ClientAcceptanceTestConfig) {
  const { storeName, expectedStoreName, createStoreWithClient, createStoreWithClientAndOptions } = config;

  describe(`${storeName} with pre-configured client`, () => {
    it('should accept a pre-configured client', () => {
      const store = createStoreWithClient();
      expect(store).toBeDefined();
      expect(store.name).toBe(expectedStoreName);
    });

    it('should work with pre-configured client for storage operations', async () => {
      const store = createStoreWithClient();
      await store.init();

      const thread: ThreadData = {
        id: `thread-client-test-${Date.now()}`,
        resourceId: 'test-resource',
        title: 'Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        const savedThread = await store.saveThread({ thread });
        expect(savedThread.id).toBe(thread.id);

        const retrievedThread = await store.getThreadById({ threadId: thread.id });
        expect(retrievedThread).toBeDefined();
        expect(retrievedThread?.title).toBe('Test Thread');
      } finally {
        // Clean up
        await store.deleteThread({ threadId: thread.id });
      }
    });

    if (createStoreWithClientAndOptions) {
      it('should accept client with additional options', () => {
        const store = createStoreWithClientAndOptions();
        expect(store).toBeDefined();
      });
    }
  });
}
