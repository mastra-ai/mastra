import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Agent } from '../../../agent';
import type { MastraScorer } from '../../../evals/base';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { RunsInMemory } from '../../../storage/domains/runs/inmemory';
import { runDataset } from '../index';

// Mock isSupportedLanguageModel at module level
vi.mock('../../../agent', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    isSupportedLanguageModel: vi.fn().mockReturnValue(true),
  };
});

// Helper: mock agent with configurable behavior
const createMockAgent = (
  opts: { delayMs?: number; shouldFail?: boolean; response?: string; failMessage?: string } = {},
): Agent => {
  const { delayMs = 0, shouldFail = false, response = 'ok', failMessage = 'Agent error' } = opts;
  return {
    id: 'test-agent',
    name: 'Test Agent',
    getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
    generate: vi.fn().mockImplementation(async () => {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      if (shouldFail) throw new Error(failMessage);
      return { text: response };
    }),
  } as unknown as Agent;
};

// Helper: create a mock scorer with configurable delay
const createDelayedScorer = (id: string, name: string, delayMs: number): MastraScorer<any, any, any, any> =>
  ({
    id,
    name,
    description: `Mock scorer ${id}`,
    run: vi.fn().mockImplementation(async () => {
      await new Promise(r => setTimeout(r, delayMs));
      return { score: 1.0, reason: 'ok' };
    }),
  }) as unknown as MastraScorer<any, any, any, any>;

// Shared test infrastructure
let db: InMemoryDB;
let datasetsStorage: DatasetsInMemory;
let runsStorage: RunsInMemory;
let mockStorage: MastraCompositeStore;
let mastra: Mastra;
let datasetId: string;

async function setupDataset(itemCount: number) {
  db = new InMemoryDB();
  datasetsStorage = new DatasetsInMemory({ db });
  runsStorage = new RunsInMemory({ db });

  const dataset = await datasetsStorage.createDataset({
    name: 'P1 Test Dataset',
    description: 'Regression',
  });
  datasetId = dataset.id;

  for (let i = 0; i < itemCount; i++) {
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: { prompt: `item-${i}` },
      expectedOutput: null,
    });
  }

  mockStorage = {
    id: 'test-storage',
    stores: {
      datasets: datasetsStorage,
      runs: runsStorage,
    } as unknown as StorageDomains,
    getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
      if (name === 'datasets') return datasetsStorage;
      if (name === 'runs') return runsStorage;
      return undefined;
    }),
  } as unknown as MastraCompositeStore;
}

function setupMastra(agent: Agent) {
  mastra = {
    getStorage: vi.fn().mockReturnValue(mockStorage),
    getAgent: vi.fn().mockReturnValue(agent),
    getAgentById: vi.fn().mockReturnValue(agent),
    getScorerById: vi.fn(),
    getWorkflowById: vi.fn(),
    getWorkflow: vi.fn(),
  } as unknown as Mastra;
}

describe('P1 Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Issue 6: Memory accumulation ---

  describe('Issue 6: retainResults', () => {
    it('T-6a: retainResults false → empty results, counters accurate', async () => {
      await setupDataset(3);
      const agent = createMockAgent();
      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        retainResults: false,
      });

      expect(result.results).toHaveLength(0);
      expect(result.succeededCount).toBe(3);
      expect(result.status).toBe('completed');
    });

    it('T-6b: retainResults true (default) → results populated', async () => {
      await setupDataset(3);
      const agent = createMockAgent();
      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(result.results).toHaveLength(3);
    });
  });

  // --- Issue 7: Retry logic ---

  describe('Issue 7: Retry', () => {
    it('T-7a: retries transient failure and succeeds', async () => {
      await setupDataset(1);

      let callCount = 0;
      const agent = {
        id: 'retry-agent',
        name: 'Retry Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 2) throw new Error('429 rate limit exceeded');
          return { text: 'ok' };
        }),
      } as unknown as Agent;

      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'retry-agent',
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(result.succeededCount).toBe(1);
      expect(result.results[0].retryCount).toBe(2);
      expect(result.results[0].error).toBeNull();
      expect(callCount).toBe(3);
    });

    it('T-7b: no retry when maxRetries is 0 (default)', async () => {
      await setupDataset(2);
      const agent = createMockAgent({ shouldFail: true });
      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 1,
      });

      // Agent called exactly once per item (no retry)
      expect(agent.generate).toHaveBeenCalledTimes(2);
      expect(result.results[0].retryCount).toBe(0);
      expect(result.failedCount).toBe(2);
    });

    it('T-7c: non-retryable error is not retried', async () => {
      await setupDataset(1);
      const agent = createMockAgent({ shouldFail: true, failMessage: 'Invalid input format' });
      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxRetries: 2,
        retryDelay: 10,
      });

      // Non-transient error: should only be called once
      expect(agent.generate).toHaveBeenCalledTimes(1);
      expect(result.results[0].retryCount).toBe(0);
      expect(result.failedCount).toBe(1);
    });

    it('T-7d: abort during retry backoff stops retries', { timeout: 5000 }, async () => {
      await setupDataset(1);

      // Agent always fails with transient error
      const agent = createMockAgent({ shouldFail: true, failMessage: '429 rate limit exceeded' });
      setupMastra(agent);

      const controller = new AbortController();
      // Abort after 80ms — during first retry backoff (retryDelay=50)
      setTimeout(() => controller.abort(), 80);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxRetries: 5,
        retryDelay: 50,
        signal: controller.signal,
      });

      // Should have called at most 2 times (initial + maybe 1 retry before abort)
      expect((agent.generate as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(2);
      // Run should resolve (not hang)
      expect(result).toBeDefined();
    });
  });

  // --- Issue 8: Parallel scorers ---

  describe('Issue 8: Parallel scorers', () => {
    it('T-8a: parallel scorers faster than sequential', { timeout: 5000 }, async () => {
      await setupDataset(5);
      const agent = createMockAgent();
      setupMastra(agent);

      const scorer1 = createDelayedScorer('s1', 'Scorer 1', 100);
      const scorer2 = createDelayedScorer('s2', 'Scorer 2', 100);
      const scorer3 = createDelayedScorer('s3', 'Scorer 3', 100);

      const start = performance.now();
      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [scorer1, scorer2, scorer3],
        maxConcurrency: 5,
      });
      const elapsed = performance.now() - start;

      // Parallel: ~100ms per item (all 3 scorers run concurrently)
      // Sequential would be: ~300ms per item × 5 items = 1500ms
      // Parallel should be: ~100ms per item × (5 items / 5 concurrency) = ~100ms
      // Be generous: < 750ms means they're running in parallel
      expect(elapsed).toBeLessThan(750);

      // All items should have 3 scores
      for (const item of result.results) {
        expect(item.scores).toHaveLength(3);
        const scorerIds = item.scores.map(s => s.scorerId);
        expect(scorerIds).toContain('s1');
        expect(scorerIds).toContain('s2');
        expect(scorerIds).toContain('s3');
      }
    });

    it('T-8b: scorer error isolation under parallel execution', async () => {
      await setupDataset(1);
      const agent = createMockAgent();
      setupMastra(agent);

      const failingScorer: MastraScorer<any, any, any, any> = {
        id: 'failing',
        name: 'Failing Scorer',
        description: 'Always fails',
        run: vi.fn().mockRejectedValue(new Error('Scorer crash')),
      };
      const workingScorer1 = createDelayedScorer('ok1', 'OK 1', 10);
      const workingScorer2 = createDelayedScorer('ok2', 'OK 2', 10);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [failingScorer, workingScorer1, workingScorer2],
      });

      expect(result.status).toBe('completed');
      const scores = result.results[0].scores;
      expect(scores).toHaveLength(3);

      const failedScore = scores.find(s => s.scorerId === 'failing');
      expect(failedScore?.error).toBe('Scorer crash');
      expect(failedScore?.score).toBeNull();

      const ok1 = scores.find(s => s.scorerId === 'ok1');
      expect(ok1?.score).toBe(1.0);
      expect(ok1?.error).toBeNull();

      const ok2 = scores.find(s => s.scorerId === 'ok2');
      expect(ok2?.score).toBe(1.0);
      expect(ok2?.error).toBeNull();
    });
  });

  // --- Issue 9: completedWithErrors ---

  describe('Issue 9: completedWithErrors', () => {
    it('T-9a: completedWithErrors true on partial failure', async () => {
      await setupDataset(2);

      let callCount = 0;
      const agent = {
        id: 'partial-agent',
        name: 'Partial Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) throw new Error('Fail first');
          return { text: 'ok' };
        }),
      } as unknown as Agent;

      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'partial-agent',
        maxConcurrency: 1,
      });

      expect(result.status).toBe('completed');
      expect(result.completedWithErrors).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.succeededCount).toBe(1);
    });

    it('T-9b: completedWithErrors false when all succeed', async () => {
      await setupDataset(2);
      const agent = createMockAgent();
      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(result.status).toBe('completed');
      expect(result.completedWithErrors).toBe(false);
    });
  });

  // --- Issue 10: skippedCount ---

  describe('Issue 10: skippedCount', () => {
    it('T-10a: skippedCount on abort', { timeout: 5000 }, async () => {
      await setupDataset(10);
      const agent = createMockAgent({ delayMs: 200 });
      setupMastra(agent);

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 300);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 2,
        signal: controller.signal,
      });

      expect(result.skippedCount).toBeGreaterThan(0);
      expect(result.succeededCount + result.failedCount + result.skippedCount).toBe(result.totalItems);
    });

    it('T-10b: skippedCount is 0 on normal completion', async () => {
      await setupDataset(3);
      const agent = createMockAgent();
      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(result.skippedCount).toBe(0);
      expect(result.succeededCount).toBe(3);
      expect(result.succeededCount + result.failedCount + result.skippedCount).toBe(result.totalItems);
    });
  });

  // --- Issue 11: Results ordering ---

  describe('Issue 11: Results ordering', () => {
    it('T-11: results in dataset order regardless of completion order', async () => {
      await setupDataset(3);

      // Items complete in reverse order due to varying delays
      const items = await datasetsStorage.getItemsByVersion({
        datasetId,
        version: (await datasetsStorage.getDatasetById({ id: datasetId }))!.version,
      });

      let callIndex = 0;
      const agent = {
        id: 'varied-agent',
        name: 'Varied Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async (input: any) => {
          // item-0: 200ms, item-1: 50ms, item-2: 10ms
          const delays: Record<string, number> = { 'item-0': 200, 'item-1': 50, 'item-2': 10 };
          const prompt = input?.prompt ?? `item-${callIndex++}`;
          const delay = delays[prompt] ?? 10;
          await new Promise(r => setTimeout(r, delay));
          return { text: `response-${prompt}` };
        }),
      } as unknown as Agent;

      setupMastra(agent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'varied-agent',
        maxConcurrency: 3,
      });

      // Results should be in dataset order, not completion order
      expect(result.results[0].itemId).toBe(items[0].id);
      expect(result.results[1].itemId).toBe(items[1].id);
      expect(result.results[2].itemId).toBe(items[2].id);
    });
  });
});
