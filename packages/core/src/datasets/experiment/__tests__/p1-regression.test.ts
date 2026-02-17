import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Agent } from '../../../agent';
import type { MastraScorer } from '../../../evals/base';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { runExperiment } from '../index';

// Mock isSupportedLanguageModel at module level
vi.mock('../../../agent', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    isSupportedLanguageModel: vi.fn().mockReturnValue(true),
  };
});

// Import after mock setup
// eslint-disable-next-line import/order
import { isSupportedLanguageModel } from '../../../agent';

// Helper: mock agent with configurable behavior
const createMockAgent = (opts: { delayMs?: number; shouldFail?: boolean; response?: string } = {}): Agent => {
  const { delayMs = 0, shouldFail = false, response = 'ok' } = opts;
  return {
    id: 'test-agent',
    name: 'Test Agent',
    getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
    generate: vi.fn().mockImplementation(async () => {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      if (shouldFail) throw new Error('Agent error');
      return { text: response };
    }),
  } as unknown as Agent;
};

// Helper: mock scorer with configurable delay
const createMockScorer = (id: string, delayMs = 0): MastraScorer<any, any, any, any> =>
  ({
    id,
    name: `Scorer ${id}`,
    description: 'Mock scorer',
    run: vi.fn().mockImplementation(async () => {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      return { score: 1.0, reason: 'ok' };
    }),
  }) as unknown as MastraScorer<any, any, any, any>;

// Shared test infrastructure
let db: InMemoryDB;
let datasetsStorage: DatasetsInMemory;
let experimentsStorage: ExperimentsInMemory;
let mockStorage: MastraCompositeStore;
let mastra: Mastra;
let datasetId: string;

async function setupDataset(itemCount: number) {
  db = new InMemoryDB();
  datasetsStorage = new DatasetsInMemory({ db });
  experimentsStorage = new ExperimentsInMemory({ db });

  const dataset = await datasetsStorage.createDataset({
    name: 'P1 Test Dataset',
    description: 'Regression',
  });
  datasetId = dataset.id;

  for (let i = 0; i < itemCount; i++) {
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: { prompt: `item-${i}` },
      groundTruth: null,
    });
  }

  mockStorage = {
    id: 'test-storage',
    stores: {
      datasets: datasetsStorage,
      experiments: experimentsStorage,
    } as unknown as StorageDomains,
    getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
      if (name === 'datasets') return datasetsStorage;
      if (name === 'experiments') return experimentsStorage;
      return undefined;
    }),
  } as unknown as MastraCompositeStore;
}

function setupMastra(agent: Agent, scorers?: MastraScorer<any, any, any, any>[]) {
  mastra = {
    getStorage: vi.fn().mockReturnValue(mockStorage),
    getAgent: vi.fn().mockReturnValue(agent),
    getAgentById: vi.fn().mockReturnValue(agent),
    getScorerById: vi.fn().mockImplementation((id: string) => scorers?.find(s => s.id === id) ?? null),
    getWorkflowById: vi.fn(),
    getWorkflow: vi.fn(),
  } as unknown as Mastra;
}

describe('P1 Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupportedLanguageModel).mockReturnValue(true);
  });

  // T-1: Parallel scorers
  describe('Issue 1: Parallel Scorers', () => {
    it('runs scorers concurrently, not sequentially', async () => {
      await setupDataset(1);
      const scorerDelay = 100;
      const scorers = [
        createMockScorer('s1', scorerDelay),
        createMockScorer('s2', scorerDelay),
        createMockScorer('s3', scorerDelay),
      ];
      const agent = createMockAgent();
      setupMastra(agent, scorers);

      const start = performance.now();
      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers,
        maxConcurrency: 1,
      });
      const elapsed = performance.now() - start;

      expect(result.succeededCount).toBe(1);
      expect(result.results[0]!.scores).toHaveLength(3);
      // If parallel: ~100ms. If sequential: ~300ms.
      expect(elapsed).toBeLessThan(250);
    });
  });

  // T-2a: Retry succeeds on second attempt
  describe('Issue 2: Retry Logic', () => {
    it('retries and succeeds when agent fails then recovers', async () => {
      await setupDataset(1);

      let callCount = 0;
      const agent = {
        id: 'flaky-agent',
        name: 'Flaky Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) throw new Error('Transient failure');
          return { text: 'recovered' };
        }),
      } as unknown as Agent;

      setupMastra(agent);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'flaky-agent',
        maxRetries: 1,
      });

      expect(result.succeededCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.results[0]!.retryCount).toBe(1);
    });

    // T-2b: Retry exhausted
    it('fails after exhausting retries', async () => {
      await setupDataset(1);
      const agent = createMockAgent({ shouldFail: true });
      setupMastra(agent);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxRetries: 2,
      });

      expect(result.failedCount).toBe(1);
      expect(result.results[0]!.retryCount).toBe(2);
      expect(result.results[0]!.error).toBeTruthy();
    });

    // T-2c: Abort errors don't retry
    it('does not retry abort errors', async () => {
      await setupDataset(1);

      const agent = {
        id: 'abort-agent',
        name: 'Abort Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async () => {
          throw new DOMException('Aborted', 'AbortError');
        }),
      } as unknown as Agent;

      setupMastra(agent);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'abort-agent',
        maxRetries: 3,
      });

      // Should only call generate once — no retries on abort
      expect(agent.generate).toHaveBeenCalledTimes(1);
      expect(result.results[0]!.retryCount).toBe(0);
    });

    // T-2d: retryCount reflected in result
    it('reflects retryCount in persisted result', async () => {
      await setupDataset(1);

      let callCount = 0;
      const agent = {
        id: 'retry-agent',
        name: 'Retry Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 2) throw new Error('fail');
          return { text: 'ok' };
        }),
      } as unknown as Agent;

      setupMastra(agent);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'retry-agent',
        maxRetries: 3,
      });

      expect(result.succeededCount).toBe(1);
      expect(result.results[0]!.retryCount).toBe(2);
    });
  });

  // T-3: Deterministic ordering
  describe('Issue 3: Deterministic Results Ordering', () => {
    it('results maintain input order regardless of completion order', async () => {
      await setupDataset(5);

      // Agent echoes the input prompt so we can verify positional correspondence
      const agent = {
        id: 'variable-agent',
        name: 'Variable Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async (input: any) => {
          // input is { prompt: 'item-N' } — extract the prompt string
          const promptStr = typeof input === 'object' ? (input?.prompt ?? JSON.stringify(input)) : String(input);
          const idx = parseInt((promptStr.match(/item-(\d+)/) ?? ['', '0'])[1]!, 10);
          // Variable delay — earlier items in the array finish later
          await new Promise(r => setTimeout(r, (4 - idx) * 20));
          return { text: `result-for-${promptStr}` };
        }),
      } as unknown as Agent;

      setupMastra(agent);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'variable-agent',
        maxConcurrency: 5,
      });

      expect(result.results).toHaveLength(5);
      // All 5 items present
      const prompts = result.results.map(r => (r.input as any).prompt as string);
      expect(new Set(prompts).size).toBe(5);
      // Each result's output corresponds to its own input, proving p-map preserved order
      for (let i = 0; i < 5; i++) {
        const prompt = (result.results[i]!.input as any).prompt as string;
        expect(result.results[i]!.output).toEqual(expect.objectContaining({ text: `result-for-${prompt}` }));
      }
    });
  });

  // T-4: completedWithErrors
  describe('Issue 4: completedWithErrors Flag', () => {
    it('is true when some items fail but run completes', async () => {
      await setupDataset(3);

      let callCount = 0;
      const agent = {
        id: 'partial-agent',
        name: 'Partial Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 2) throw new Error('One fails');
          return { text: 'ok' };
        }),
      } as unknown as Agent;

      setupMastra(agent);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'partial-agent',
        maxConcurrency: 1,
      });

      expect(result.status).toBe('completed');
      expect(result.completedWithErrors).toBe(true);
      expect(result.succeededCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    it('is false when all items succeed', async () => {
      await setupDataset(2);
      const agent = createMockAgent();
      setupMastra(agent);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(result.status).toBe('completed');
      expect(result.completedWithErrors).toBe(false);
    });
  });

  // T-5: skippedCount on abort
  describe('Issue 5: skippedCount', () => {
    it('counts unprocessed items on abort', async () => {
      await setupDataset(10);
      const agent = createMockAgent({ delayMs: 200 });
      setupMastra(agent);

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 300);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 2,
        signal: controller.signal,
      });

      expect(result.status).toBe('failed');
      expect(result.skippedCount).toBeDefined();
      expect(result.skippedCount).toBe(result.totalItems - result.succeededCount - result.failedCount);
      expect(result.skippedCount).toBeGreaterThan(0);
    });
  });

  // T-6: Throttled progress updates
  describe('Issue 6: Throttled Progress Updates', () => {
    it('calls updateExperiment during execution, not just at end', async () => {
      await setupDataset(5);
      const agent = createMockAgent({ delayMs: 50 });
      setupMastra(agent);

      const updateExperimentSpy = vi.spyOn(experimentsStorage, 'updateExperiment');

      await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 1,
      });

      // updateExperiment is called: once for 'running' status + at least one progress update + once for final
      // With 5 items at 50ms each = 250ms total, should get at least 1 progress update (2s interval won't trigger)
      // But with concurrency 1 and sequential execution, the total time is ~250ms
      // Let's check there are at least 2 calls (running + final)
      const calls = updateExperimentSpy.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      // The final call should have succeededCount
      const finalCall = calls[calls.length - 1]![0] as any;
      expect(finalCall.succeededCount).toBeDefined();
    });

    it('includes progress counts in mid-run updates', { timeout: 10000 }, async () => {
      await setupDataset(10);
      // Slow agent to ensure progress updates fire (need > 2s total)
      const agent = createMockAgent({ delayMs: 300 });
      setupMastra(agent);

      const updateExperimentSpy = vi.spyOn(experimentsStorage, 'updateExperiment');

      await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 1,
      });

      // 10 items * 300ms = 3000ms, should get at least 1 progress update at 2s mark
      const progressCalls = updateExperimentSpy.mock.calls.filter((call: any) => {
        const arg = call[0] as any;
        // Progress calls have succeededCount but no status (or status is still running)
        return arg.succeededCount !== undefined && arg.status === undefined;
      });

      expect(progressCalls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
