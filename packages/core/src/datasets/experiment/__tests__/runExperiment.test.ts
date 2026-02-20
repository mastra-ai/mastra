import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MastraScorer } from '../../../evals/base';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { runExperiment } from '../index';

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

describe('runExperiment', () => {
  let db: InMemoryDB;
  let datasetsStorage: DatasetsInMemory;
  let experimentsStorage: ExperimentsInMemory;
  let mockStorage: MastraCompositeStore;
  let mastra: Mastra;
  let datasetId: string;

  beforeEach(async () => {
    // Create fresh db and storage instances
    db = new InMemoryDB();
    datasetsStorage = new DatasetsInMemory({ db });
    experimentsStorage = new ExperimentsInMemory({ db });

    // Create test dataset with items
    const dataset = await datasetsStorage.createDataset({
      name: 'Test Dataset',
      description: 'For testing',
    });
    datasetId = dataset.id;

    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: { prompt: 'Hello' },
      groundTruth: { text: 'Hi' },
    });
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: { prompt: 'Goodbye' },
      groundTruth: { text: 'Bye' },
    });

    // Create mock storage that returns the stores
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
      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(result.experimentId).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.totalItems).toBe(2);
      expect(result.succeededCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('includes item details in results', async () => {
      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      const itemResult = result.results[0];
      expect(itemResult.itemId).toBeDefined();
      expect(itemResult.input).toBeDefined();
      expect(itemResult.output).toBeDefined();
      expect(itemResult.error).toBeNull();
      expect(itemResult.startedAt).toBeInstanceOf(Date);
      expect(itemResult.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('status transitions', () => {
    it('creates run with pending status then transitions to completed', async () => {
      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      // Verify final status
      expect(result.status).toBe('completed');

      // Verify run was persisted
      const storedRun = await experimentsStorage.getExperimentById({ id: result.experimentId });
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

      const result = await runExperiment(mastra, {
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

      expect(failedItem?.error).toEqual(expect.objectContaining({ message: 'First call fails' }));
      expect(successItem?.output).toEqual(expect.objectContaining({ text: 'Success' }));
    });

    it('marks run as failed when all items fail', async () => {
      const failingAgent = createMockAgent('', true);
      (mastra.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(failingAgent);
      (mastra.getAgentById as ReturnType<typeof vi.fn>).mockReturnValue(failingAgent);

      const result = await runExperiment(mastra, {
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
        runExperiment(mastra, {
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
        runExperiment(mastra, {
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

      const result = await runExperiment(mastra, {
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

      const result = await runExperiment(mastra, {
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

      const result = await runExperiment(mastra, {
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
    it('respects AbortSignal and returns partial summary', async () => {
      const controller = new AbortController();

      // Abort immediately
      controller.abort();

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        signal: controller.signal,
      });

      // Should resolve with failed status, not reject
      expect(result.status).toBe('failed');
      expect(result.results).toHaveLength(0);
      expect(result.totalItems).toBe(2);
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

      await runExperiment(mastra, {
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

      const result = await runExperiment(mastra, {
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
        groundTruth: { humanScore: 1.0 },
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

      const runResult = await runExperiment(mastra, {
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

  describe('inline data + inline task', () => {
    // Test 1 — Inline data array (no storage fetch)
    it('runs experiment with inline data array', async () => {
      const inlineData = [
        { input: { prompt: 'Hello' }, groundTruth: { text: 'Hi' } },
        { input: { prompt: 'Goodbye' }, groundTruth: { text: 'Bye' } },
        { input: { prompt: 'Thanks' }, groundTruth: { text: 'Welcome' } },
      ];

      const result = await runExperiment(mastra, {
        datasetId,
        data: inlineData,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(result.totalItems).toBe(3);
      expect(result.succeededCount).toBe(3);
      expect(result.status).toBe('completed');
      // Each result has correct input matching the inline data
      expect(result.results[0].input).toEqual({ prompt: 'Hello' });
      expect(result.results[1].input).toEqual({ prompt: 'Goodbye' });
      expect(result.results[2].input).toEqual({ prompt: 'Thanks' });
      // Items have auto-generated UUIDs
      for (const r of result.results) {
        expect(r.itemId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    });

    // Test 2 — Inline data factory function
    it('runs experiment with inline data factory function', async () => {
      const factory = vi.fn().mockResolvedValue([{ input: { prompt: 'from-factory' } }]);

      const result = await runExperiment(mastra, {
        datasetId,
        data: factory,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(factory).toHaveBeenCalledTimes(1);
      expect(result.totalItems).toBe(1);
      expect(result.results[0].input).toEqual({ prompt: 'from-factory' });
    });

    // Test 3 — Inline task function
    it('runs experiment with inline task function', async () => {
      const result = await runExperiment(mastra, {
        datasetId,
        task: async ({ input }) => 'processed-' + (input as any).prompt,
      });

      expect(result.status).toBe('completed');
      const outputs = result.results.map(r => r.output).sort();
      expect(outputs).toEqual(['processed-Goodbye', 'processed-Hello']);
      for (const r of result.results) {
        expect(r.error).toBeNull();
      }
    });

    // Test 4 — Inline task receives all arguments
    it('inline task receives input, mastra, groundTruth, metadata, and signal', async () => {
      // Create dataset with metadata
      const metaDataset = await datasetsStorage.createDataset({ name: 'Meta Dataset' });
      await datasetsStorage.addItem({
        datasetId: metaDataset.id,
        input: { prompt: 'test' },
        groundTruth: { expected: 'answer' },
        metadata: { source: 'unit-test' },
      });

      const capturedArgs: any[] = [];
      const result = await runExperiment(mastra, {
        datasetId: metaDataset.id,
        task: async args => {
          capturedArgs.push(args);
          return 'ok';
        },
      });

      expect(result.status).toBe('completed');
      expect(capturedArgs).toHaveLength(1);
      expect(capturedArgs[0].input).toEqual({ prompt: 'test' });
      expect(capturedArgs[0].mastra).toBe(mastra);
      expect(capturedArgs[0].groundTruth).toEqual({ expected: 'answer' });
      expect(capturedArgs[0].metadata).toEqual({ source: 'unit-test' });
      // signal is only present when itemTimeout is set or a run-level signal is provided
      // Without those, signal is undefined
      expect('signal' in capturedArgs[0]).toBe(true);
    });

    // Test 5 — Inline data + inline task (full inline experiment)
    it('runs full inline experiment with both data and task', async () => {
      const result = await runExperiment(mastra, {
        datasetId,
        data: [{ input: { prompt: 'A' } }, { input: { prompt: 'B' } }],
        task: async ({ input }) => 'result-' + (input as any).prompt,
      });

      expect(result.status).toBe('completed');
      expect(result.totalItems).toBe(2);
      expect(result.results[0].input).toEqual({ prompt: 'A' });
      expect(result.results[0].output).toBe('result-A');
      expect(result.results[1].input).toEqual({ prompt: 'B' });
      expect(result.results[1].output).toBe('result-B');
    });

    // Test 6 — Inline task returns sync value
    it('inline task supports synchronous return value', async () => {
      const result = await runExperiment(mastra, {
        datasetId,
        data: [{ input: { prompt: 'sync-test' } }],
        task: ({ input }) => 'sync-' + (input as any).prompt,
      });

      expect(result.status).toBe('completed');
      expect(result.results[0].output).toBe('sync-sync-test');
    });

    // Test 7 — Inline task error isolation
    it('inline task error for one item does not fail entire experiment', async () => {
      const result = await runExperiment(mastra, {
        datasetId,
        data: [{ input: { prompt: 'good' } }, { input: { prompt: 'bad' } }, { input: { prompt: 'also-good' } }],
        task: async ({ input }) => {
          if ((input as any).prompt === 'bad') {
            throw new Error('Task failed for bad input');
          }
          return 'ok-' + (input as any).prompt;
        },
        maxConcurrency: 1,
      });

      expect(result.status).toBe('completed');
      expect(result.completedWithErrors).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.succeededCount).toBe(2);

      const failedItem = result.results.find(r => r.error !== null);
      expect(failedItem?.output).toBeNull();
      expect(failedItem?.error).toEqual(expect.objectContaining({ message: 'Task failed for bad input' }));

      const successItems = result.results.filter(r => r.error === null);
      expect(successItems).toHaveLength(2);
      for (const item of successItems) {
        expect(item.output).toMatch(/^ok-/);
      }
    });

    // Test 8 — No data source → throws
    it('throws when no data source is provided', async () => {
      await expect(
        runExperiment(mastra, {
          task: async ({ input }) => input,
        }),
      ).rejects.toThrow('No data source: provide datasetId or data');
    });

    // Test 9 — No task source → throws
    it('throws when no task source is provided', async () => {
      await expect(
        runExperiment(mastra, {
          datasetId,
        }),
      ).rejects.toThrow('No task: provide targetType+targetId or task');
    });

    // Test 10 — Backward compatibility (existing config shape)
    it('backward compatible with existing config shape', async () => {
      const mockScorer = createMockScorer('compat-scorer', 'Compat Scorer');

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [mockScorer],
      });

      expect(result.status).toBe('completed');
      expect(result.totalItems).toBe(2);
      expect(result.succeededCount).toBe(2);
      expect(result.results[0].scores).toHaveLength(1);
      expect(result.results[0].scores[0].scorerId).toBe('compat-scorer');
    });

    // Test 11 — experimentId field works
    it('uses provided experimentId', async () => {
      // Pre-create the run record (simulates async trigger path)
      await experimentsStorage.createExperiment({
        id: 'pre-created-id',
        datasetId,
        datasetVersion: null,
        targetType: 'agent',
        targetId: 'inline',
        totalItems: 1,
      });

      const createExperimentSpy = vi.spyOn(experimentsStorage, 'createExperiment');

      const result = await runExperiment(mastra, {
        datasetId,
        data: [{ input: { prompt: 'test' } }],
        task: async () => 'output',
        experimentId: 'pre-created-id',
      });

      expect(result.experimentId).toBe('pre-created-id');
      // createExperiment should NOT have been called again (experimentId was provided)
      expect(createExperimentSpy).not.toHaveBeenCalled();
      createExperimentSpy.mockRestore();
    });

    // Test 12 — Inline data + scorers verify groundTruth pipeline
    it('passes groundTruth through full pipeline to scorer', async () => {
      const mockScorer = createMockScorer('gt-scorer', 'GroundTruth Scorer');

      const result = await runExperiment(mastra, {
        datasetId,
        data: [{ input: { q: 'hello' }, groundTruth: 'expected-answer' }],
        task: async () => 'some-output',
        scorers: [mockScorer],
      });

      expect(result.status).toBe('completed');
      // Verify scorer was called with correct arguments
      expect(mockScorer.run).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { q: 'hello' },
          output: 'some-output',
          groundTruth: 'expected-answer',
        }),
      );
    });
  });

  describe('targetVersionId resolution', () => {
    it('resolves agent at specific version via editor when targetVersionId is set', async () => {
      const versionedAgent = createMockAgent('Versioned Response');
      const editorGetById = vi.fn().mockResolvedValue(versionedAgent);

      mastra = {
        ...mastra,
        getEditor: vi.fn().mockReturnValue({
          agent: { getById: editorGetById },
        }),
      } as unknown as Mastra;

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'stored-agent',
        targetVersionId: 'version-uuid-123',
      });

      expect(result.status).toBe('completed');
      expect(result.succeededCount).toBe(2);
      expect(editorGetById).toHaveBeenCalledWith('stored-agent', { versionId: 'version-uuid-123' });
      // Should NOT have called registry fallback
      expect(mastra.getAgentById).not.toHaveBeenCalled();
      expect(mastra.getAgent).not.toHaveBeenCalled();
    });

    it('falls back to registry when editor returns null for targetVersionId', async () => {
      const registryAgent = createMockAgent('Registry Response');
      const editorGetById = vi.fn().mockResolvedValue(null);

      mastra = {
        ...mastra,
        getEditor: vi.fn().mockReturnValue({
          agent: { getById: editorGetById },
        }),
        getAgentById: vi.fn().mockReturnValue(registryAgent),
        getAgent: vi.fn().mockReturnValue(registryAgent),
      } as unknown as Mastra;

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'some-agent',
        targetVersionId: 'nonexistent-version',
      });

      expect(result.status).toBe('completed');
      expect(editorGetById).toHaveBeenCalled();
      // Fell through to registry
      expect(mastra.getAgentById).toHaveBeenCalled();
    });

    it('falls back to registry when getEditor() returns undefined', async () => {
      const registryAgent = createMockAgent('Registry Response');

      mastra = {
        ...mastra,
        getEditor: vi.fn().mockReturnValue(undefined),
        getAgentById: vi.fn().mockReturnValue(registryAgent),
        getAgent: vi.fn().mockReturnValue(registryAgent),
      } as unknown as Mastra;

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'some-agent',
        targetVersionId: 'some-version',
      });

      expect(result.status).toBe('completed');
      expect(mastra.getAgentById).toHaveBeenCalled();
    });

    it('does not call getEditor when targetVersionId is not set', async () => {
      const mockAgent = createMockAgent('Response');
      const getEditorSpy = vi.fn();

      mastra = {
        ...mastra,
        getEditor: getEditorSpy,
        getAgentById: vi.fn().mockReturnValue(mockAgent),
        getAgent: vi.fn().mockReturnValue(mockAgent),
      } as unknown as Mastra;

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      expect(result.status).toBe('completed');
      expect(getEditorSpy).not.toHaveBeenCalled();
    });

    it('ignores targetVersionId for workflow targets', async () => {
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
      const getEditorSpy = vi.fn();

      mastra = {
        ...mastra,
        getEditor: getEditorSpy,
        getWorkflowById: vi.fn().mockReturnValue(mockWorkflow),
        getWorkflow: vi.fn().mockReturnValue(mockWorkflow),
      } as unknown as Mastra;

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'workflow',
        targetId: 'test-workflow',
        targetVersionId: 'some-version',
      });

      expect(result.status).toBe('completed');
      expect(getEditorSpy).not.toHaveBeenCalled();
    });

    it('ignores targetVersionId for scorer targets', async () => {
      const mockScorer = {
        id: 'target-scorer',
        name: 'Target Scorer',
        description: 'Scorer under test',
        run: vi.fn().mockResolvedValue({ score: 0.9, reason: 'Good' }),
      };
      const getEditorSpy = vi.fn();

      mastra = {
        ...mastra,
        getEditor: getEditorSpy,
        getScorerById: vi.fn().mockReturnValue(mockScorer),
      } as unknown as Mastra;

      const scorerDataset = await datasetsStorage.createDataset({ name: 'Scorer Version Test' });
      await datasetsStorage.addItem({
        datasetId: scorerDataset.id,
        input: { input: 'test', output: 'test', groundTruth: 'test' },
      });

      const result = await runExperiment(mastra, {
        datasetId: scorerDataset.id,
        targetType: 'scorer',
        targetId: 'target-scorer',
        targetVersionId: 'some-version',
      });

      expect(result.status).toBe('completed');
      expect(getEditorSpy).not.toHaveBeenCalled();
    });
  });
});
