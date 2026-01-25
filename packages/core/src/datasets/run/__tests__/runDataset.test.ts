import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { RunsInMemory } from '../../../storage/domains/runs/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { runDataset } from '../index';
import type { MastraScorer } from '../../../evals/base';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import type { Mastra } from '../../../mastra';

// Mock agent that returns predictable output
// Note: specificationVersion must be 'v2' or 'v3' for isSupportedLanguageModel to return true
const createMockAgent = (response: string, shouldFail = false) => ({
  id: 'test-agent',
  name: 'Test Agent',
  getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
  generate: vi.fn().mockImplementation(async () => {
    if (shouldFail) {
      throw new Error('Agent error');
    }
    return { text: response };
  }),
});

// Mock scorer that returns score based on output
const createMockScorer = (scorerId: string, scorerName: string): MastraScorer<any, any, any, any> => ({
  id: scorerId,
  name: scorerName,
  description: 'Mock scorer',
  run: vi.fn().mockImplementation(async ({ output }) => ({
    score: output ? 1.0 : 0.0,
    reason: output ? 'Has output' : 'No output',
  })),
});

describe('runDataset', () => {
  let db: InMemoryDB;
  let datasetsStorage: DatasetsInMemory;
  let runsStorage: RunsInMemory;
  let mockStorage: MastraCompositeStore;
  let mastra: Mastra;
  let datasetId: string;

  beforeEach(async () => {
    // Create fresh db and storage instances
    db = new InMemoryDB();
    datasetsStorage = new DatasetsInMemory({ db });
    runsStorage = new RunsInMemory({ db });

    // Create test dataset with items
    const dataset = await datasetsStorage.createDataset({
      name: 'Test Dataset',
      description: 'For testing',
    });
    datasetId = dataset.id;

    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: { prompt: 'Hello' },
      expectedOutput: { text: 'Hi' },
    });
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: { prompt: 'Goodbye' },
      expectedOutput: { text: 'Bye' },
    });

    // Create mock storage that returns the stores
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

    // Create mock Mastra with storage and mock agent
    const mockAgent = createMockAgent('Response');
    mastra = {
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getAgent: vi.fn().mockReturnValue(mockAgent),
      getAgentById: vi.fn().mockReturnValue(mockAgent),
      getScorerById: vi.fn(),
      getWorkflowById: vi.fn(),
      getWorkflow: vi.fn(),
    } as unknown as Mastra;
  });

  describe('basic execution', () => {
    it('executes all items and returns summary', async () => {
      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(result.runId).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.totalItems).toBe(2);
      expect(result.succeededCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('includes item details in results', async () => {
      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      const itemResult = result.results[0];
      expect(itemResult.itemId).toBeDefined();
      expect(itemResult.input).toBeDefined();
      expect(itemResult.output).toBeDefined();
      expect(itemResult.latency).toBeGreaterThanOrEqual(0);
      expect(itemResult.error).toBeNull();
      expect(itemResult.startedAt).toBeInstanceOf(Date);
      expect(itemResult.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('status transitions', () => {
    it('creates run with pending status then transitions to completed', async () => {
      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      // Verify final status
      expect(result.status).toBe('completed');

      // Verify run was persisted
      const storedRun = await runsStorage.getRunById({ id: result.runId });
      expect(storedRun?.status).toBe('completed');
      expect(storedRun?.succeededCount).toBe(2);
      expect(storedRun?.failedCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('continues on item error (continue-on-error semantics)', async () => {
      // Create agent that fails on first call, succeeds on second
      let callCount = 0;
      const flakyAgent = {
        id: 'flaky-agent',
        name: 'Flaky Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('First call fails');
          }
          return { text: 'Success' };
        }),
      };

      (mastra.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(flakyAgent);
      (mastra.getAgentById as ReturnType<typeof vi.fn>).mockReturnValue(flakyAgent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'flaky-agent',
        maxConcurrency: 1, // Sequential to ensure order
      });

      // Run should complete (not fail) with partial success
      expect(result.status).toBe('completed');
      expect(result.succeededCount).toBe(1);
      expect(result.failedCount).toBe(1);

      // Check individual results
      const failedItem = result.results.find(r => r.error !== null);
      const successItem = result.results.find(r => r.error === null);

      expect(failedItem?.error).toBe('First call fails');
      expect(successItem?.output).toEqual({ text: 'Success' });
    });

    it('marks run as failed when all items fail', async () => {
      const failingAgent = createMockAgent('', true);
      (mastra.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(failingAgent);
      (mastra.getAgentById as ReturnType<typeof vi.fn>).mockReturnValue(failingAgent);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'failing-agent',
      });

      expect(result.status).toBe('failed');
      expect(result.succeededCount).toBe(0);
      expect(result.failedCount).toBe(2);
    });

    it('throws for non-existent dataset', async () => {
      await expect(
        runDataset(mastra, {
          datasetId: 'non-existent',
          targetType: 'agent',
          targetId: 'test-agent',
        }),
      ).rejects.toThrow('Dataset not found');
    });

    it('throws for non-existent target', async () => {
      (mastra.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (mastra.getAgentById as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await expect(
        runDataset(mastra, {
          datasetId,
          targetType: 'agent',
          targetId: 'missing-agent',
        }),
      ).rejects.toThrow('Target not found');
    });
  });

  describe('scoring', () => {
    it('applies scorers and includes results', async () => {
      const mockScorer = createMockScorer('accuracy', 'Accuracy');

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [mockScorer],
      });

      // Each item should have scores
      expect(result.results[0].scores).toHaveLength(1);
      expect(result.results[0].scores[0].scorerId).toBe('accuracy');
      expect(result.results[0].scores[0].score).toBe(1.0); // Has output
    });

    it('handles scorer errors gracefully (error isolation)', async () => {
      const failingScorer: MastraScorer<any, any, any, any> = {
        id: 'failing-scorer',
        name: 'Failing Scorer',
        description: 'Always fails',
        run: vi.fn().mockRejectedValue(new Error('Scorer crashed')),
      };

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [failingScorer],
      });

      // Run should still complete
      expect(result.status).toBe('completed');

      // Scorer error should be captured in score result
      expect(result.results[0].scores[0].error).toBe('Scorer crashed');
      expect(result.results[0].scores[0].score).toBeNull();
    });

    it('failing scorer does not affect other scorers', async () => {
      const failingScorer: MastraScorer<any, any, any, any> = {
        id: 'failing-scorer',
        name: 'Failing Scorer',
        description: 'Always fails',
        run: vi.fn().mockRejectedValue(new Error('Scorer crashed')),
      };
      const workingScorer = createMockScorer('working', 'Working Scorer');

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [failingScorer, workingScorer],
      });

      // Run should complete
      expect(result.status).toBe('completed');

      // Both scorers should have results
      expect(result.results[0].scores).toHaveLength(2);

      // Failing scorer
      const failedScore = result.results[0].scores.find(s => s.scorerId === 'failing-scorer');
      expect(failedScore?.error).toBe('Scorer crashed');
      expect(failedScore?.score).toBeNull();

      // Working scorer
      const workingScore = result.results[0].scores.find(s => s.scorerId === 'working');
      expect(workingScore?.score).toBe(1.0);
      expect(workingScore?.error).toBeNull();
    });
  });

  describe('cancellation', () => {
    it('respects AbortSignal', async () => {
      const controller = new AbortController();

      // Abort immediately
      controller.abort();

      await expect(
        runDataset(mastra, {
          datasetId,
          targetType: 'agent',
          targetId: 'test-agent',
          signal: controller.signal,
        }),
      ).rejects.toThrow('Aborted');
    });
  });

  describe('concurrency', () => {
    it('respects maxConcurrency setting', async () => {
      const callTimestamps: number[] = [];
      const slowAgent = {
        id: 'slow-agent',
        name: 'Slow Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(async () => {
          callTimestamps.push(Date.now());
          await new Promise(r => setTimeout(r, 50));
          return { text: 'Done' };
        }),
      };

      (mastra.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(slowAgent);
      (mastra.getAgentById as ReturnType<typeof vi.fn>).mockReturnValue(slowAgent);

      await runDataset(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'slow-agent',
        maxConcurrency: 1, // Sequential
      });

      // With maxConcurrency=1, calls should be sequential
      // Second call should start after first (50ms gap)
      if (callTimestamps.length === 2) {
        const gap = callTimestamps[1] - callTimestamps[0];
        expect(gap).toBeGreaterThanOrEqual(40); // Allow some tolerance
      }
    });
  });

  describe('workflow target', () => {
    it('executes dataset items against workflow', async () => {
      const mockWorkflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        createRun: vi.fn().mockImplementation(async () => ({
          start: vi.fn().mockResolvedValue({
            status: 'success',
            result: { answer: 'Workflow result' },
          }),
        })),
      };

      (mastra.getWorkflow as ReturnType<typeof vi.fn>).mockReturnValue(mockWorkflow);
      (mastra.getWorkflowById as ReturnType<typeof vi.fn>).mockReturnValue(mockWorkflow);

      const result = await runDataset(mastra, {
        datasetId,
        targetType: 'workflow',
        targetId: 'test-workflow',
      });

      expect(result.status).toBe('completed');
      expect(result.succeededCount).toBe(2);
      expect(mockWorkflow.createRun).toHaveBeenCalledTimes(2);
    });
  });

  describe('scorer target', () => {
    it('executes scorer target and applies meta-scorers', async () => {
      // Create dataset with item containing full scorer input (user structures it)
      const scorerDataset = await datasetsStorage.createDataset({ name: 'Scorer Test' });
      await datasetsStorage.addItem({
        datasetId: scorerDataset.id,
        // item.input contains exactly what scorer expects - direct passthrough
        input: {
          input: { question: 'What is AI?' },
          output: { response: 'AI is artificial intelligence.' },
          groundTruth: { label: 'good' },
        },
        // Human label for alignment analysis (Phase 5 analytics)
        expectedOutput: { humanScore: 1.0 },
      });

      // Mock scorer as target (the scorer being calibrated)
      const mockTargetScorer = {
        id: 'target-scorer',
        name: 'Target Scorer',
        description: 'Scorer under test',
        run: vi.fn().mockResolvedValue({ score: 0.9, reason: 'Accurate' }),
      };

      // Mock meta-scorer (scores the scorer's output)
      const mockMetaScorer = {
        id: 'meta-scorer',
        name: 'Meta Scorer',
        description: 'Evaluates scorer calibration',
        run: vi.fn().mockResolvedValue({ score: 0.95, reason: 'Good calibration' }),
      };

      (mastra.getScorerById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
        if (id === 'target-scorer') return mockTargetScorer;
        if (id === 'meta-scorer') return mockMetaScorer;
        return null;
      });

      const runResult = await runDataset(mastra, {
        datasetId: scorerDataset.id,
        targetId: 'target-scorer',
        targetType: 'scorer',
        scorers: [mockMetaScorer],
      });

      expect(runResult.status).toBe('completed');
      expect(runResult.results).toHaveLength(1);
      // Scorer's output is stored in result.output
      expect(runResult.results[0].output).toEqual({ score: 0.9, reason: 'Accurate' });
      // Verify scorer received item.input directly (no field mapping)
      expect(mockTargetScorer.run).toHaveBeenCalledWith({
        input: { question: 'What is AI?' },
        output: { response: 'AI is artificial intelligence.' },
        groundTruth: { label: 'good' },
      });
      // Meta-scorer should have been applied
      expect(runResult.results[0].scores).toHaveLength(1);
      expect(runResult.results[0].scores[0].scorerId).toBe('meta-scorer');
    });
  });
});
