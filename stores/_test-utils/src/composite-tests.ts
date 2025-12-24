import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MastraStorage, InMemoryStore } from '@mastra/core/storage';

/**
 * Configuration for MastraStorage composition tests
 */
export interface CompositeTestConfig {
  /**
   * Create a default storage instance for the composite.
   * If not provided, InMemoryStore will be used.
   */
  createDefaultStorage?: () => MastraStorage;

  /**
   * Create an alternate storage instance for domain overrides.
   * If not provided, a second InMemoryStore will be used.
   */
  createAlternateStorage?: () => MastraStorage;

  /**
   * Optional test name suffix
   */
  testNameSuffix?: string;
}

/**
 * Creates tests that verify MastraStorage behavior.
 *
 * Tests include:
 * - Domain precedence (overrides take priority over default)
 * - Data isolation between domains
 * - Initialization and cleanup of composed stores
 * - Various composition patterns
 *
 */
export function createMastraStorageTests(config: CompositeTestConfig = {}) {
  const testName = config.testNameSuffix ? `MastraStorage (${config.testNameSuffix})` : 'MastraStorage';

  const createDefault = config.createDefaultStorage ?? (() => new InMemoryStore({ id: 'default' }));
  const createAlternate = config.createAlternateStorage ?? (() => new InMemoryStore({ id: 'alternate' }));

  describe(testName, () => {
    describe('Basic Composition', () => {
      let defaultStore: MastraStorage;
      let composite: MastraStorage;

      beforeAll(async () => {
        defaultStore = createDefault();
        await defaultStore.init();

        composite = new MastraStorage({
          id: 'composite-basic',
          default: defaultStore,
        });
        await composite.init();
      });

      afterAll(async () => {
        const memory = await composite.getStore('memory');
        if (memory) await memory.dangerouslyClearAll();
      });

      it('should use default storage for all domains', async () => {
        const memory = await composite.getStore('memory');
        expect(memory).toBeDefined();

        const workflows = await composite.getStore('workflows');
        expect(workflows).toBeDefined();

        const scores = await composite.getStore('scores');
        expect(scores).toBeDefined();
      });

      it('should perform basic operations through composite', async () => {
        const memory = await composite.getStore('memory');
        expect(memory).toBeDefined();

        const thread = {
          id: `composite-thread-${Date.now()}`,
          resourceId: 'test-resource',
          title: 'Composite Test Thread',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const savedThread = await memory!.saveThread({ thread });
        expect(savedThread.id).toBe(thread.id);

        const retrieved = await memory!.getThreadById({ threadId: thread.id });
        expect(retrieved?.title).toBe('Composite Test Thread');

        await memory!.deleteThread({ threadId: thread.id });
      });
    });

    describe('Domain Overrides', () => {
      let defaultStore: MastraStorage;
      let alternateStore: MastraStorage;
      let composite: MastraStorage;

      beforeAll(async () => {
        defaultStore = createDefault();
        alternateStore = createAlternate();

        await Promise.all([defaultStore.init(), alternateStore.init()]);

        // Use memory from alternate, everything else from default
        composite = new MastraStorage({
          id: 'composite-overrides',
          default: defaultStore,
          domains: {
            memory: alternateStore.stores?.memory,
          },
        });
        await composite.init();
      });

      afterAll(async () => {
        const memory = await composite.getStore('memory');
        const workflows = await composite.getStore('workflows');
        if (memory) await memory.dangerouslyClearAll();
        if (workflows) await workflows.dangerouslyClearAll();
      });

      it('should use overridden domain instead of default', async () => {
        const compositeMemory = await composite.getStore('memory');
        const alternateMemory = await alternateStore.getStore('memory');

        // Both should be defined and should be the same instance
        expect(compositeMemory).toBeDefined();
        expect(alternateMemory).toBeDefined();
        expect(compositeMemory).toBe(alternateMemory);
      });

      it('should use default for non-overridden domains', async () => {
        const compositeWorkflows = await composite.getStore('workflows');
        const defaultWorkflows = await defaultStore.getStore('workflows');

        expect(compositeWorkflows).toBeDefined();
        expect(defaultWorkflows).toBeDefined();
        expect(compositeWorkflows).toBe(defaultWorkflows);
      });

      it('should isolate data between domains from different stores', async () => {
        const memory = await composite.getStore('memory');
        const workflows = await composite.getStore('workflows');

        // Save a thread through composite (goes to alternate)
        const thread = {
          id: `isolated-thread-${Date.now()}`,
          resourceId: 'test-resource',
          title: 'Isolated Thread',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await memory!.saveThread({ thread });

        // Save a workflow through composite (goes to default)
        const runId = `isolated-run-${Date.now()}`;
        await workflows!.persistWorkflowSnapshot({
          workflowName: 'isolated-workflow',
          runId,
          snapshot: {
            runId,
            value: { step: 'test' },
            context: { requestContext: {} },
            activePaths: [],
            suspendedPaths: {},
            timestamp: Date.now(),
          } as any,
        });

        // Verify thread is in alternate store
        const alternateMemory = await alternateStore.getStore('memory');
        const threadFromAlternate = await alternateMemory!.getThreadById({ threadId: thread.id });
        expect(threadFromAlternate).toBeDefined();

        // Verify workflow is in default store
        const defaultWorkflows = await defaultStore.getStore('workflows');
        const snapshotFromDefault = await defaultWorkflows!.loadWorkflowSnapshot({
          workflowName: 'isolated-workflow',
          runId,
        });
        expect(snapshotFromDefault).toBeDefined();

        // Cleanup
        await memory!.deleteThread({ threadId: thread.id });
        await workflows!.deleteWorkflowRunById({ workflowName: 'isolated-workflow', runId });
      });
    });

    describe('No Default Storage', () => {
      let store1: MastraStorage;
      let store2: MastraStorage;
      let composite: MastraStorage;

      beforeAll(async () => {
        store1 = createDefault();
        store2 = createAlternate();

        await Promise.all([store1.init(), store2.init()]);

        // Compose without default - explicitly specify each domain
        composite = new MastraStorage({
          id: 'composite-no-default',
          domains: {
            memory: store1.stores?.memory,
            workflows: store2.stores?.workflows,
            scores: store1.stores?.scores,
          },
        });
        await composite.init();
      });

      afterAll(async () => {
        const memory = await composite.getStore('memory');
        const workflows = await composite.getStore('workflows');
        const scores = await composite.getStore('scores');
        if (memory) await memory.dangerouslyClearAll();
        if (workflows) await workflows.dangerouslyClearAll();
        if (scores) await scores.dangerouslyClearAll();
      });

      it('should work with explicitly specified domains only', async () => {
        const memory = await composite.getStore('memory');
        const workflows = await composite.getStore('workflows');
        const scores = await composite.getStore('scores');

        expect(memory).toBeDefined();
        expect(workflows).toBeDefined();
        expect(scores).toBeDefined();
      });

      it('should return undefined for unspecified domains', async () => {
        // observability and agents were not specified
        const observability = await composite.getStore('observability');
        const agents = await composite.getStore('agents');

        expect(observability).toBeUndefined();
        expect(agents).toBeUndefined();
      });

      it('should perform operations on mixed-source domains', async () => {
        const memory = await composite.getStore('memory');
        const workflows = await composite.getStore('workflows');

        // Memory operation (from store1)
        const thread = {
          id: `mixed-thread-${Date.now()}`,
          resourceId: 'test-resource',
          title: 'Mixed Source Thread',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const savedThread = await memory!.saveThread({ thread });
        expect(savedThread.id).toBe(thread.id);

        // Workflow operation (from store2)
        const runId = `mixed-run-${Date.now()}`;
        await workflows!.persistWorkflowSnapshot({
          workflowName: 'mixed-workflow',
          runId,
          snapshot: {
            runId,
            value: { step: 'mixed' },
            context: { requestContext: {} },
            activePaths: [],
            suspendedPaths: {},
            timestamp: Date.now(),
          } as any,
        });

        const snapshot = await workflows!.loadWorkflowSnapshot({
          workflowName: 'mixed-workflow',
          runId,
        });
        expect(snapshot?.runId).toBe(runId);

        // Cleanup
        await memory!.deleteThread({ threadId: thread.id });
        await workflows!.deleteWorkflowRunById({ workflowName: 'mixed-workflow', runId });
      });
    });

    describe('Configuration Edge Cases', () => {
      it('should handle empty domain overrides', async () => {
        const defaultStore = createDefault();
        await defaultStore.init();

        const composite = new MastraStorage({
          id: 'composite-empty-overrides',
          default: defaultStore,
          domains: {},
        });
        await composite.init();

        const memory = await composite.getStore('memory');
        expect(memory).toBeDefined();
      });

      it('should handle undefined domain overrides gracefully', async () => {
        const defaultStore = createDefault();
        await defaultStore.init();

        const composite = new MastraStorage({
          id: 'composite-undefined-domain',
          default: defaultStore,
          domains: {
            memory: undefined,
          },
        });
        await composite.init();

        // Should fall back to default
        const memory = await composite.getStore('memory');
        expect(memory).toBeDefined();
      });

      it('should create composite with only domains (no default)', async () => {
        const store = createDefault();
        await store.init();

        const composite = new MastraStorage({
          id: 'composite-domains-only',
          domains: {
            memory: store.stores?.memory,
          },
        });
        await composite.init();

        const memory = await composite.getStore('memory');
        expect(memory).toBeDefined();

        // No default, so other domains should be undefined
        const workflows = await composite.getStore('workflows');
        expect(workflows).toBeUndefined();
      });
    });

    describe('disableInit option', () => {
      it('should respect disableInit option', async () => {
        const defaultStore = createDefault();
        await defaultStore.init();

        const composite = new MastraStorage({
          id: 'composite-disable-init',
          default: defaultStore,
          disableInit: true,
        });

        // Should not throw even without init
        const memory = await composite.getStore('memory');
        expect(memory).toBeDefined();
      });
    });
  });
}

/**
 * Run MastraStorage composition tests using InMemoryStore.
 * This is the default test that runs without any external dependencies.
 */
export function createMastraStorageCompositionTests() {
  createMastraStorageTests();
}
