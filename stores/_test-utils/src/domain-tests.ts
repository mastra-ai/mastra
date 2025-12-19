import { describe, it, expect } from 'vitest';
import type { MemoryStorage, WorkflowsStorage, ScoresStorage } from '@mastra/core/storage';

/**
 * Configuration for the domain-level pre-configured client test factory
 */
export interface DomainTestConfig {
  /** Name of the store being tested (e.g., 'LibSQL', 'PostgreSQL') */
  storeName: string;

  /** Factory to create a Memory domain instance with pre-configured client */
  createMemoryDomain: () => MemoryStorage;

  /** Factory to create a Workflows domain instance with pre-configured client */
  createWorkflowsDomain: () => WorkflowsStorage;

  /** Factory to create a Scores domain instance with pre-configured client */
  createScoresDomain: () => ScoresStorage;

  /**
   * Optional: Factory to create a Memory domain with additional options.
   * Use this to test that domains accept extra options alongside the client.
   */
  createMemoryDomainWithOptions?: () => MemoryStorage;
}

/**
 * Creates tests that verify domain classes can be used directly with pre-configured clients.
 *
 * This factory generates tests that verify:
 * - Each domain class (Memory, Workflows, Scores) can be instantiated with a pre-configured client
 * - Basic operations work on each domain
 * - Additional options can be passed alongside the client (if applicable)
 *
 * These tests are important for users who want to use domain classes directly
 * (e.g., in Cloudflare Workers) without going through the full store abstraction.
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file::memory:' });
 *
 * createDomainDirectTests({
 *   storeName: 'LibSQL',
 *   createMemoryDomain: () => new MemoryLibSQL({ client }),
 *   createWorkflowsDomain: () => new WorkflowsLibSQL({ client }),
 *   createScoresDomain: () => new ScoresLibSQL({ client }),
 *   createMemoryDomainWithOptions: () => new MemoryLibSQL({ client, maxRetries: 10 }),
 * });
 * ```
 */
export function createDomainDirectTests(config: DomainTestConfig) {
  const { storeName, createMemoryDomain, createWorkflowsDomain, createScoresDomain, createMemoryDomainWithOptions } =
    config;

  describe(`${storeName} Domain-level Pre-configured Client`, () => {
    it('should allow using Memory domain directly with pre-configured client', async () => {
      const memoryDomain = createMemoryDomain();
      expect(memoryDomain).toBeDefined();
      await memoryDomain.init();

      const thread = {
        id: `thread-domain-test-${Date.now()}`,
        resourceId: 'test-resource',
        title: 'Test Domain Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        const savedThread = await memoryDomain.saveThread({ thread });
        expect(savedThread.id).toBe(thread.id);

        const retrievedThread = await memoryDomain.getThreadById({ threadId: thread.id });
        expect(retrievedThread).toBeDefined();
        expect(retrievedThread?.title).toBe('Test Domain Thread');
      } finally {
        await memoryDomain.deleteThread({ threadId: thread.id });
      }
    });

    it('should allow using Workflows domain directly with pre-configured client', async () => {
      const workflowsDomain = createWorkflowsDomain();
      expect(workflowsDomain).toBeDefined();
      await workflowsDomain.init();

      const workflowName = 'test-workflow';
      const runId = `run-domain-test-${Date.now()}`;

      try {
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
      } finally {
        await workflowsDomain.deleteWorkflowRunById({ workflowName, runId });
      }
    });

    it('should allow using Scores domain directly with pre-configured client', async () => {
      const scoresDomain = createScoresDomain();
      expect(scoresDomain).toBeDefined();
      await scoresDomain.init();

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

    if (createMemoryDomainWithOptions) {
      it('should allow domains to accept additional options with pre-configured client', async () => {
        const memoryDomain = createMemoryDomainWithOptions();
        expect(memoryDomain).toBeDefined();
        await memoryDomain.init();

        const thread = {
          id: `thread-options-test-${Date.now()}`,
          resourceId: 'test-resource',
          title: 'Test Options Thread',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          const savedThread = await memoryDomain.saveThread({ thread });
          expect(savedThread.id).toBe(thread.id);
        } finally {
          await memoryDomain.deleteThread({ threadId: thread.id });
        }
      });
    }
  });
}
