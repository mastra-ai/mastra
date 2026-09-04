import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { createScorer, ScorerRunError } from '../../../evals/base';
import type { MastraScorer } from '../../../evals/base';
import type { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { ObservabilityInMemory } from '../../../storage/domains/observability/inmemory';
import { ScoresInMemory } from '../../../storage/domains/scores/inmemory';
import { createStep, createWorkflow } from '../../../workflows';
import type { ExperimentEvent } from '../index';
import { EXPERIMENT_ITEM_SCORER_NOT_FOUND, runExperiment } from '../index';

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
  let scoresStorage: ScoresInMemory;
  let mockStorage: MastraCompositeStore;
  let mastra: Mastra;
  let datasetId: string;

  beforeEach(async () => {
    // Create fresh db and storage instances
    db = new InMemoryDB();
    datasetsStorage = new DatasetsInMemory({ db });
    experimentsStorage = new ExperimentsInMemory({ db });
    scoresStorage = new ScoresInMemory({ db });

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
        scores: scoresStorage,
      } as unknown as StorageDomains,
      getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
        if (name === 'datasets') return datasetsStorage;
        if (name === 'experiments') return experimentsStorage;
        if (name === 'scores') return scoresStorage;
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

    it('passes requestContext through to agent.generate()', async () => {
      const mockAgent = createMockAgent('Response');
      const localMastra = {
        ...mastra,
        getAgent: vi.fn().mockReturnValue(mockAgent),
        getAgentById: vi.fn().mockReturnValue(mockAgent),
      } as unknown as Mastra;

      const requestContext = { userId: 'dev-user-123', environment: 'development' };

      await runExperiment(localMastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        requestContext,
      });

      // agent.generate should have been called for each item
      expect(mockAgent.generate).toHaveBeenCalled();

      // Each call should include requestContext as a RequestContext instance
      const firstCallOptions = (mockAgent.generate as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(firstCallOptions.requestContext).toBeInstanceOf(RequestContext);
      expect(firstCallOptions.requestContext.all).toEqual(requestContext);
    });

    it('resolves an agent target with the requested version', async () => {
      const mockAgent = createMockAgent('Draft response');
      const getAgentById = vi.fn().mockReturnValue(mockAgent);
      const localMastra = {
        ...mastra,
        getAgentById,
      } as unknown as Mastra;

      await runExperiment(localMastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        agentVersion: 'draft-version-id',
      });

      expect(getAgentById).toHaveBeenCalledWith('test-agent', { versionId: 'draft-version-id' });
      expect(mockAgent.generate).toHaveBeenCalled();
      const resolveOrder = getAgentById.mock.invocationCallOrder[0]!;
      const generateOrder = mockAgent.generate.mock.invocationCallOrder[0]!;
      expect(resolveOrder).toBeLessThan(generateOrder);
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
      expect(result.results[0].scores[0].failedStep).toBeUndefined();
      expect(result.results[0].scores[0].completedSteps).toBeUndefined();
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

    it('retains completed scorer output and stage context without persisting a failed score', async () => {
      const recoveredFailure = new ScorerRunError({
        scorerId: 'partial-scorer',
        steps: ['analyze', 'generateScore', 'generateReason'],
        failedStep: 'generateReason',
        completedSteps: ['analyze', 'generateScore'],
        result: {
          output: 'Response',
          runId: 'partial-run',
          score: 0,
          analyzeStepResult: { relevant: true },
          analyzePrompt: 'analyze the response',
          generateScorePrompt: 'score the response',
        },
        cause: new Error('reason failed'),
      });
      const partialScorer = {
        id: 'partial-scorer',
        name: 'Partial Scorer',
        description: 'Fails after computing a score',
        run: vi.fn().mockRejectedValue(recoveredFailure),
      } as unknown as MastraScorer<any, any, any, any>;
      const emptyFailureScorer = {
        id: 'empty-failure-scorer',
        name: 'Empty Failure Scorer',
        description: 'Fails before computing a score',
        run: vi.fn().mockRejectedValue(
          new ScorerRunError({
            scorerId: 'empty-failure-scorer',
            steps: ['generateScore'],
            failedStep: 'generateScore',
            completedSteps: [],
            cause: new Error('score failed'),
          }),
        ),
      } as unknown as MastraScorer<any, any, any, any>;
      const workingScorer = createMockScorer('working', 'Working Scorer');

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [partialScorer, emptyFailureScorer, workingScorer],
      });

      const partialResult = result.results[0].scores.find(score => score.scorerId === 'partial-scorer');
      expect(partialResult).toMatchObject({
        score: 0,
        reason: null,
        error: 'Scorer Run Failed: reason failed',
        failedStep: 'generateReason',
        completedSteps: ['analyze', 'generateScore'],
        targetScope: 'span',
      });
      expect(result.results[0].scores.find(score => score.scorerId === 'empty-failure-scorer')).toMatchObject({
        score: null,
        reason: null,
        error: 'Scorer Run Failed: score failed',
        failedStep: 'generateScore',
        completedSteps: [],
      });
      expect(result.results[0].scores.find(score => score.scorerId === 'working')).toMatchObject({
        score: 1,
        error: null,
      });
      const scoreStoreLookups = (mockStorage.getStore as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([domain]) => domain === 'scores',
      );
      expect(scoreStoreLookups).toHaveLength(2);
    });
  });

  describe('scorer source precedence', () => {
    it('uses run-level scorers instead of item and dataset scorer IDs', async () => {
      const runScorer = createMockScorer('run', 'Run');
      const lowerScorer = createMockScorer('lower', 'Lower');
      const dataset = await datasetsStorage.createDataset({ name: 'Run override', scorerIds: ['lower'] });
      await datasetsStorage.addItem({
        datasetId: dataset.id,
        input: { prompt: 'test' },
        scorerIds: ['missing-item-scorer'],
      });
      (mastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue(lowerScorer);

      const result = await runExperiment(mastra, {
        datasetId: dataset.id,
        task: async () => 'output',
        scorers: [runScorer, runScorer],
      });

      expect(result.results[0].scores.map(score => score.scorerId)).toEqual(['run', 'run']);
      expect(runScorer.run).toHaveBeenCalledTimes(2);
      expect(lowerScorer.run).not.toHaveBeenCalled();
      expect(mastra.getScorerById).not.toHaveBeenCalled();
    });

    it('treats an explicit run-level empty array as an override', async () => {
      const lowerScorer = createMockScorer('lower', 'Lower');
      const dataset = await datasetsStorage.createDataset({ name: 'Empty run override', scorerIds: ['lower'] });
      await datasetsStorage.addItem({
        datasetId: dataset.id,
        input: { prompt: 'test' },
        scorerIds: ['lower'],
      });
      (mastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue(lowerScorer);

      const result = await runExperiment(mastra, {
        datasetId: dataset.id,
        task: async () => 'output',
        scorers: [],
      });

      expect(result.results[0].scores).toEqual([]);
      expect(lowerScorer.run).not.toHaveBeenCalled();
      expect(mastra.getScorerById).not.toHaveBeenCalled();
    });

    it('treats an empty categorized run-level config as an override', async () => {
      const lowerScorer = createMockScorer('lower', 'Lower');
      (mastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue(lowerScorer);

      const result = await runExperiment(mastra, {
        data: [{ input: { prompt: 'test' }, scorerIds: ['lower'] }],
        task: async () => 'output',
        scorers: { agent: [] },
      });

      expect(result.results[0].scores).toEqual([]);
      expect(lowerScorer.run).not.toHaveBeenCalled();
      expect(mastra.getScorerById).not.toHaveBeenCalled();
    });

    it('uses item scorer IDs before dataset IDs and preserves empty item overrides', async () => {
      const itemScorer = createMockScorer('item', 'Item');
      const datasetScorer = createMockScorer('dataset', 'Dataset');
      const sharedScorer = createMockScorer('shared', 'Shared');
      const scorerRegistry = new Map([
        ['item', itemScorer],
        ['dataset', datasetScorer],
        ['shared', sharedScorer],
      ]);
      (mastra.getScorerById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => scorerRegistry.get(id));

      const dataset = await datasetsStorage.createDataset({
        name: 'Item precedence',
        scorerIds: ['dataset', 'shared', 'dataset'],
      });
      await datasetsStorage.addItem({
        datasetId: dataset.id,
        input: { prompt: 'item' },
        scorerIds: ['item', 'shared', 'item'],
      });
      await datasetsStorage.addItem({
        datasetId: dataset.id,
        input: { prompt: 'empty' },
        scorerIds: [],
      });
      await datasetsStorage.addItem({ datasetId: dataset.id, input: { prompt: 'dataset' } });

      const result = await runExperiment(mastra, {
        datasetId: dataset.id,
        task: async ({ input }) => input,
        maxConcurrency: 1,
      });

      const scorerIdsByPrompt = Object.fromEntries(
        result.results.map(item => [
          (item.input as { prompt: string }).prompt,
          item.scores.map(score => score.scorerId),
        ]),
      );
      expect(scorerIdsByPrompt).toEqual({
        item: ['item', 'shared'],
        empty: [],
        dataset: ['dataset', 'shared'],
      });
      expect(itemScorer.run).toHaveBeenCalledTimes(1);
      expect(datasetScorer.run).toHaveBeenCalledTimes(1);
      expect(sharedScorer.run).toHaveBeenCalledTimes(2);
    });

    it('does not resolve dataset scorer IDs when every item has an override', async () => {
      const task = vi.fn().mockResolvedValue('output');
      const getScorerById = vi.fn().mockImplementation(() => {
        throw new Error('Scorer not found');
      });
      const localMastra = { ...mastra, getScorerById } as unknown as Mastra;
      const dataset = await datasetsStorage.createDataset({
        name: 'Ignored dataset scorer',
        scorerIds: ['missing-dataset'],
      });
      await datasetsStorage.addItem({
        datasetId: dataset.id,
        input: { prompt: 'disabled' },
        scorerIds: [],
      });

      const result = await runExperiment(localMastra, { datasetId: dataset.id, task });

      expect(result.status).toBe('completed');
      expect(result.results[0].scores).toEqual([]);
      expect(task).toHaveBeenCalledTimes(1);
      expect(getScorerById).not.toHaveBeenCalled();
    });

    it('runs no scorers when no source is configured', async () => {
      const result = await runExperiment(mastra, {
        data: [{ input: { prompt: 'test' } }],
        task: async () => 'output',
      });

      expect(result.results[0].scores).toEqual([]);
      expect(mastra.getScorerById).not.toHaveBeenCalled();
    });

    it('supports scorer IDs on inline data', async () => {
      const itemScorer = createMockScorer('inline-item', 'Inline Item');
      (mastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue(itemScorer);

      const result = await runExperiment(mastra, {
        data: [{ input: { prompt: 'test' }, scorerIds: ['inline-item'] }],
        task: async () => 'output',
      });

      expect(result.results[0].scores.map(score => score.scorerId)).toEqual(['inline-item']);
    });

    it('hydrates stored item scorers through Editor and caches resolution for the run', async () => {
      const storedScorer = createMockScorer('stored', 'Stored');
      let hydrated = false;
      const getStoredScorer = vi.fn().mockImplementation(async () => {
        hydrated = true;
        return { id: 'stored' };
      });
      const localMastra = {
        ...mastra,
        getScorerById: vi.fn().mockImplementation(() => (hydrated ? storedScorer : undefined)),
        getEditor: vi.fn().mockReturnValue({ scorer: { getById: getStoredScorer } }),
      } as unknown as Mastra;

      const result = await runExperiment(localMastra, {
        data: [
          { input: { prompt: 'first' }, scorerIds: ['stored'] },
          { input: { prompt: 'second' }, scorerIds: ['stored'] },
        ],
        task: async () => 'output',
      });

      expect(result.results.every(item => item.scores[0]?.scorerId === 'stored')).toBe(true);
      expect(getStoredScorer).toHaveBeenCalledTimes(1);
      expect(storedScorer.run).toHaveBeenCalledTimes(2);
    });

    it('fails only an item with stale scorer IDs before target execution and without retries', async () => {
      const task = vi.fn().mockResolvedValue('output');
      const localMastra = {
        ...mastra,
        getScorerById: vi.fn().mockImplementation(() => {
          throw new Error('Scorer not found');
        }),
      } as unknown as Mastra;
      const result = await runExperiment(localMastra, {
        data: [
          { id: 'stale-item', input: { prompt: 'stale' }, scorerIds: ['missing'] },
          { id: 'valid-item', input: { prompt: 'valid' }, scorerIds: [] },
        ],
        task,
        maxConcurrency: 1,
        maxRetries: 2,
      });

      expect(result.status).toBe('completed');
      expect(result.completedWithErrors).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.succeededCount).toBe(1);
      expect(task).toHaveBeenCalledTimes(1);

      const staleResult = result.results[0];
      expect(staleResult.error).toEqual({
        code: EXPERIMENT_ITEM_SCORER_NOT_FOUND,
        message: 'Item scorer configuration references unregistered scorer IDs: missing',
      });
      expect(staleResult.output).toBeNull();
      expect(staleResult.retryCount).toBe(0);
      expect(staleResult.scores).toEqual([]);

      const persisted = await experimentsStorage.listExperimentResults({
        experimentId: result.experimentId,
        pagination: { page: 0, perPage: 10 },
      });
      expect(persisted.results.find(item => item.itemId === 'stale-item')?.error).toEqual(staleResult.error);
    });

    it('rejects experiment setup when a selected run-level scorer ID is missing', async () => {
      const task = vi.fn().mockResolvedValue('output');
      const localMastra = {
        ...mastra,
        getScorerById: vi.fn().mockImplementation(() => {
          throw new Error('Scorer not found');
        }),
      } as unknown as Mastra;

      await expect(
        runExperiment(localMastra, {
          data: [{ input: { prompt: 'run' } }],
          task,
          scorers: ['missing-run'],
        }),
      ).rejects.toThrow('Scorer not found');
      expect(task).not.toHaveBeenCalled();
    });

    it('rejects experiment setup when a selected dataset scorer ID is missing', async () => {
      const task = vi.fn().mockResolvedValue('output');
      const localMastra = {
        ...mastra,
        getScorerById: vi.fn().mockImplementation(() => {
          throw new Error('Scorer not found');
        }),
      } as unknown as Mastra;
      const dataset = await datasetsStorage.createDataset({
        name: 'Missing dataset scorer',
        scorerIds: ['missing-dataset'],
      });
      await datasetsStorage.addItem({ datasetId: dataset.id, input: { prompt: 'dataset' } });

      await expect(runExperiment(localMastra, { datasetId: dataset.id, task })).rejects.toThrow('Scorer not found');
      expect(task).not.toHaveBeenCalled();
    });
  });

  describe('persistence policy', () => {
    it('preserves experiment and score persistence by default', async () => {
      const scorer = createMockScorer('default-scorer', 'Default Scorer');

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [scorer],
      });

      expect(result.results).toHaveLength(2);
      expect(result.results.every(item => item.scores[0]?.score === 1)).toBe(true);
      expect(db.experiments.size).toBe(1);
      expect(db.experimentResults.size).toBe(2);
      expect(db.scores.size).toBe(2);
    });

    it('suppresses experiment writes independently while still persisting scores', async () => {
      const scorer = createMockScorer('score-only', 'Score Only');

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [scorer],
        persistence: { experiments: 'none' },
      });

      expect(result.status).toBe('completed');
      expect(result.persistenceFailures).toBe(0);
      expect(result.results.every(item => item.scores[0]?.score === 1)).toBe(true);
      expect(db.experiments.size).toBe(0);
      expect(db.experimentResults.size).toBe(0);
      expect(db.scores.size).toBe(2);
      expect(mockStorage.getStore).not.toHaveBeenCalledWith('experiments');
    });

    it('suppresses score writes independently while still returning scores and persisting experiment results', async () => {
      const scorer = createMockScorer('in-memory-only', 'In-memory Only');

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [scorer],
        persistence: { scores: 'none' },
      });

      expect(scorer.run).toHaveBeenCalledTimes(2);
      expect(result.results.every(item => item.scores[0]?.score === 1)).toBe(true);
      expect(db.experiments.size).toBe(1);
      expect(db.experimentResults.size).toBe(2);
      expect(db.scores.size).toBe(0);
      expect(mockStorage.getStore).not.toHaveBeenCalledWith('scores');
    });

    it('suppresses observability score records from real scorers while retaining in-memory results', async () => {
      const scorer = createScorer({
        id: 'real-persistence-scorer',
        description: 'Exercises real scorer persistence',
      }).generateScore(() => 0.75);
      const observabilityStorage = new ObservabilityInMemory({ db });
      const addScore = vi.fn(async ({ traceId, spanId, score }) => {
        await observabilityStorage.createScore({
          score: {
            ...score,
            scoreId: crypto.randomUUID(),
            traceId: traceId ?? null,
            spanId: spanId ?? null,
            timestamp: new Date(),
          },
        });
      });
      const localMastra = {
        ...mastra,
        observability: {
          addScore,
          getSelectedInstance: vi.fn().mockReturnValue(undefined),
        },
        getLogger: vi.fn().mockReturnValue({
          debug: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          trackException: vi.fn(),
        }),
      } as unknown as Mastra;
      scorer.__registerMastra(localMastra);

      const defaultResult = await runExperiment(localMastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [scorer],
      });

      expect(defaultResult.results.map(item => item.scores)).toEqual([
        [expect.objectContaining({ score: 0.75 })],
        [expect.objectContaining({ score: 0.75 })],
      ]);
      expect((await observabilityStorage.listScores({})).scores).toHaveLength(2);

      db.scoreRecords.length = 0;
      db.scores.clear();
      addScore.mockClear();

      const suppressedResult = await runExperiment(localMastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [scorer],
        persistence: { scores: 'none' },
      });

      expect(suppressedResult.results.every(item => item.scores[0]?.score === 0.75)).toBe(true);
      expect(addScore).not.toHaveBeenCalled();
      expect((await observabilityStorage.listScores({})).scores).toHaveLength(0);
      expect(db.scores.size).toBe(0);
    });

    it('performs no selected-domain writes when a run is cancelled', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [createMockScorer('cancelled', 'Cancelled')],
        signal: controller.signal,
        persistence: { experiments: 'none', scores: 'none' },
      });

      expect(result.status).toBe('failed');
      expect(result.results).toHaveLength(0);
      expect(db.experiments.size).toBe(0);
      expect(db.experimentResults.size).toBe(0);
      expect(db.scores.size).toBe(0);
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

    // Regression test for issue #15453: a real Workflow is thenable (has a `.then`
    // builder method). Returning one from an async resolver caused Promise
    // unwrapping to hang forever. Uses a real createWorkflow instance rather than
    // a plain mock so the thenable behaviour is exercised.
    it('runs against a real workflow instance without hanging', async () => {
      const inputSchema = z.object({ prompt: z.string() });
      const outputSchema = z.object({ text: z.string() });

      const echoStep = createStep({
        id: 'echo',
        inputSchema,
        outputSchema,
        execute: async ({ inputData }) => ({ text: `echo:${inputData.prompt}` }),
      });

      const workflow = createWorkflow({
        id: 'real-echo-wf',
        inputSchema,
        outputSchema,
      })
        .then(echoStep)
        .commit();

      (mastra.getWorkflowById as ReturnType<typeof vi.fn>).mockReturnValue(workflow);
      (mastra.getWorkflow as ReturnType<typeof vi.fn>).mockReturnValue(workflow);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'workflow',
        targetId: 'real-echo-wf',
        itemTimeout: 5_000,
      });

      expect(result.status).toBe('completed');
      expect(result.succeededCount).toBe(2);
      expect(result.failedCount).toBe(0);
      const outputs = result.results.map(r => r.output);
      expect(outputs).toEqual(expect.arrayContaining([{ text: 'echo:Hello' }, { text: 'echo:Goodbye' }]));
    }, 10_000);

    it('uses categorized run-level workflow and step scorers as the winning source', async () => {
      const inputSchema = z.object({ prompt: z.string() });
      const outputSchema = z.object({ text: z.string() });
      const echoStep = createStep({
        id: 'echo',
        inputSchema,
        outputSchema,
        execute: async ({ inputData }) => ({ text: `echo:${inputData.prompt}` }),
      });
      const workflow = createWorkflow({
        id: 'categorized-wf',
        inputSchema,
        outputSchema,
      })
        .then(echoStep)
        .commit();
      (mastra.getWorkflowById as ReturnType<typeof vi.fn>).mockReturnValue(workflow);
      (mastra.getWorkflow as ReturnType<typeof vi.fn>).mockReturnValue(workflow);

      const workflowScorer = createMockScorer('workflow-run', 'Workflow Run');
      const stepScorer = createMockScorer('workflow-step', 'Workflow Step');
      const lowerScorer = createMockScorer('lower', 'Lower');
      const dataset = await datasetsStorage.createDataset({ name: 'Categorized', scorerIds: ['lower'] });
      await datasetsStorage.addItem({
        datasetId: dataset.id,
        input: { prompt: 'Hello' },
        scorerIds: ['lower'],
      });
      (mastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue(lowerScorer);

      const result = await runExperiment(mastra, {
        datasetId: dataset.id,
        targetType: 'workflow',
        targetId: 'categorized-wf',
        scorers: {
          workflow: [workflowScorer],
          steps: { echo: [stepScorer] },
        },
      });

      expect(result.results[0].scores.map(score => score.scorerId)).toEqual(['workflow-run', 'workflow-step']);
      expect(result.results[0].scores[1]?.stepId).toBe('echo');
      expect(workflowScorer.run).toHaveBeenCalledTimes(1);
      expect(stepScorer.run).toHaveBeenCalledTimes(1);
      expect(lowerScorer.run).not.toHaveBeenCalled();
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

    // Test 2b — Per-item requestContext on inline data reaches agent.generate
    it('forwards per-item requestContext from inline data, merged over the global context', async () => {
      const mockAgent = createMockAgent('Response');
      const localMastra = {
        ...mastra,
        getAgent: vi.fn().mockReturnValue(mockAgent),
        getAgentById: vi.fn().mockReturnValue(mockAgent),
      } as unknown as Mastra;

      await runExperiment(localMastra, {
        datasetId,
        data: [{ input: { prompt: 'Hello' }, requestContext: { clinicId: 'clinic-1' } }],
        targetType: 'agent',
        targetId: 'test-agent',
        // Global context — per-item value should win on key collision
        requestContext: { clinicId: 'global-clinic', environment: 'development' },
      });

      const callOptions = (mockAgent.generate as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callOptions.requestContext).toBeInstanceOf(RequestContext);
      expect(callOptions.requestContext.all).toEqual({
        clinicId: 'clinic-1',
        environment: 'development',
      });
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

  describe('empty dataset handling', () => {
    it('marks pre-created experiment as failed when dataset has no items', async () => {
      // Create an empty dataset
      const emptyDs = await datasetsStorage.createDataset({ name: 'Empty DS' });

      // Pre-create experiment record (simulates async trigger path)
      const experiment = await experimentsStorage.createExperiment({
        datasetId: emptyDs.id,
        datasetVersion: emptyDs.version,
        targetType: 'agent',
        targetId: 'test-agent',
        totalItems: 0,
      });

      // Run experiment with pre-created ID — should throw and mark as failed
      await expect(
        runExperiment(mastra, {
          datasetId: emptyDs.id,
          experimentId: experiment.id,
          targetType: 'agent',
          targetId: 'test-agent',
        }),
      ).rejects.toThrow('No items in dataset');

      // Verify experiment was marked as failed (not stuck in pending)
      const updated = await experimentsStorage.getExperimentById({ id: experiment.id });
      expect(updated?.status).toBe('failed');
      expect(updated?.completedAt).toBeDefined();
    });

    it('throws without creating experiment record when no pre-created ID', async () => {
      const emptyDs = await datasetsStorage.createDataset({ name: 'Empty DS 2' });

      await expect(
        runExperiment(mastra, {
          datasetId: emptyDs.id,
          targetType: 'agent',
          targetId: 'test-agent',
        }),
      ).rejects.toThrow('No items in dataset');

      // No experiment record should exist for this dataset
      const result = await experimentsStorage.listExperiments({
        datasetId: emptyDs.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(result.experiments.length).toBe(0);
    });
  });

  describe('semantic event observer', () => {
    it('reports the pinned dataset version used for execution', async () => {
      const versionedDataset = await datasetsStorage.createDataset({ name: 'Versioned Dataset' });
      await datasetsStorage.addItem({ datasetId: versionedDataset.id, input: 'version 1' });
      await datasetsStorage.addItem({ datasetId: versionedDataset.id, input: 'version 2' });
      const events: ExperimentEvent[] = [];

      const summary = await runExperiment(mastra, {
        datasetId: versionedDataset.id,
        version: 1,
        task: async ({ input }) => input,
        onEvent: event => {
          events.push(event);
        },
      });

      expect(summary.totalItems).toBe(1);
      expect(summary.results[0]?.input).toBe('version 1');
      expect(events[0]).toMatchObject({
        type: 'experiment.run.started',
        datasetId: versionedDataset.id,
        datasetVersion: 1,
        totalItems: 1,
      });
    });

    it('awaits run start before executing items and emits ordered JSON-safe events with stable item identity', async () => {
      const events: ExperimentEvent[] = [];
      let releaseStart!: () => void;
      const startGate = new Promise<void>(resolve => {
        releaseStart = resolve;
      });
      const mockAgent = createMockAgent('Response');
      const mockScorer = createMockScorer('event-score', 'Event Score');
      const localMastra = {
        ...mastra,
        getAgent: vi.fn().mockReturnValue(mockAgent),
        getAgentById: vi.fn().mockReturnValue(mockAgent),
      } as unknown as Mastra;

      const run = runExperiment(localMastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        scorers: [mockScorer],
        onEvent: async event => {
          events.push(event);
          if (event.type === 'experiment.run.started') await startGate;
        },
      });

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(mockAgent.generate).not.toHaveBeenCalled();
      releaseStart();

      const summary = await run;
      expect(events.map(event => event.type)).toEqual([
        'experiment.run.started',
        'experiment.item.completed',
        'experiment.item.completed',
        'experiment.run.finished',
      ]);
      expect(events.map(event => event.sequence)).toEqual([1, 2, 3, 4]);
      expect(() => JSON.stringify(events)).not.toThrow();

      const itemEvents = events.filter(event => event.type === 'experiment.item.completed');
      expect(itemEvents.map(event => event.itemIndex).sort()).toEqual([0, 1]);
      for (const event of itemEvents) {
        expect(event.itemId).toBe(summary.results[event.itemIndex]?.itemId);
        expect(event.scores).toEqual([expect.objectContaining({ scorerId: 'event-score', score: 1 })]);
      }
    });

    it('serializes observer delivery while item execution remains concurrent', async () => {
      let activeObservers = 0;
      let maxActiveObservers = 0;
      const generate = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { text: 'Response' };
      });
      const localMastra = {
        ...mastra,
        getAgentById: vi.fn().mockReturnValue({
          ...createMockAgent('Response'),
          generate,
        }),
      } as unknown as Mastra;

      await runExperiment(localMastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 2,
        onEvent: async () => {
          activeObservers++;
          maxActiveObservers = Math.max(maxActiveObservers, activeObservers);
          await new Promise(resolve => setTimeout(resolve, 5));
          activeObservers--;
        },
      });

      expect(maxActiveObservers).toBe(1);
      expect(generate).toHaveBeenCalledTimes(2);
    });

    it('throws a typed fatal error and emits no terminal event when the observer rejects', async () => {
      const eventTypes: string[] = [];

      await expect(
        runExperiment(mastra, {
          datasetId,
          targetType: 'agent',
          targetId: 'test-agent',
          maxConcurrency: 1,
          onEvent: event => {
            eventTypes.push(event.type);
            if (event.type === 'experiment.item.completed') throw new Error('observer unavailable');
          },
        }),
      ).rejects.toMatchObject({
        id: 'EXPERIMENT_EVENT_OBSERVER_FAILED',
        details: {
          eventType: 'experiment.item.completed',
          eventSequence: 2,
        },
      });

      expect(eventTypes).toEqual(['experiment.run.started', 'experiment.item.completed']);
    });

    it('drains active item work before persisting observer failure counters', async () => {
      let releaseSlowItem!: () => void;
      let slowItemFinished = false;
      const slowItemGate = new Promise<void>(resolve => {
        releaseSlowItem = resolve;
      });
      const eventTypes: string[] = [];
      const task = vi.fn(async ({ input }) => {
        if (input === 'fast') return 'fast response';
        await slowItemGate;
        slowItemFinished = true;
        return 'slow response';
      });

      const run = runExperiment(mastra, {
        data: [
          { id: 'fast-item', input: 'fast' },
          { id: 'slow-item', input: 'slow' },
        ],
        task,
        maxConcurrency: 2,
        onEvent: event => {
          eventTypes.push(event.type);
          if (event.type === 'experiment.item.completed') throw new Error('observer unavailable');
        },
      });
      const rejection = expect(run).rejects.toMatchObject({ id: 'EXPERIMENT_EVENT_OBSERVER_FAILED' });

      await vi.waitFor(() => expect(eventTypes).toContain('experiment.item.completed'));
      let settled = false;
      void run.catch(() => {
        settled = true;
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(settled).toBe(false);

      releaseSlowItem();
      await rejection;

      expect(slowItemFinished).toBe(true);
      const experiments = await experimentsStorage.listExperiments({ pagination: { page: 0, perPage: 10 } });
      expect(experiments.experiments[0]).toMatchObject({
        status: 'failed',
        succeededCount: 2,
        failedCount: 0,
        skippedCount: 0,
      });
      const persistedResults = await experimentsStorage.listExperimentResults({
        experimentId: experiments.experiments[0]!.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(persistedResults.results).toHaveLength(2);
      expect(eventTypes).not.toContain('experiment.run.finished');
    });

    it('drains other active mapper errors after an observer failure', async () => {
      let observerRejected = false;
      let activeScorerFailed = false;
      let notifyObserverRejected!: () => void;
      let releaseSlowItem!: () => void;
      let slowItemFinished = false;
      const observerRejectionGate = new Promise<void>(resolve => {
        notifyObserverRejected = resolve;
      });
      const slowItemGate = new Promise<void>(resolve => {
        releaseSlowItem = resolve;
      });
      const scorer = createMockScorer('throwing-scorer', 'Throwing scorer');
      Object.defineProperty(scorer, 'type', {
        get() {
          if (observerRejected) {
            activeScorerFailed = true;
            throw new Error('active scorer failed');
          }
          return undefined;
        },
      });
      const task = vi.fn(async ({ input }) => {
        if (input === 'active-error') {
          await observerRejectionGate;
          await new Promise(resolve => setTimeout(resolve, 0));
        } else if (input === 'slow') {
          await slowItemGate;
          slowItemFinished = true;
        }
        return input;
      });

      const run = runExperiment(mastra, {
        data: [
          { id: 'fast-item', input: 'fast' },
          { id: 'error-item', input: 'active-error' },
          { id: 'slow-item', input: 'slow' },
        ],
        task,
        scorers: [scorer],
        maxConcurrency: 3,
        onEvent: event => {
          if (event.type === 'experiment.item.completed') {
            observerRejected = true;
            notifyObserverRejected();
            throw new Error('observer unavailable');
          }
        },
      });
      const rejection = expect(run).rejects.toMatchObject({ id: 'EXPERIMENT_EVENT_OBSERVER_FAILED' });

      await observerRejectionGate;
      await new Promise(resolve => setTimeout(resolve, 10));
      let settled = false;
      void run.catch(() => {
        settled = true;
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(settled).toBe(false);

      releaseSlowItem();
      await rejection;

      expect(activeScorerFailed).toBe(true);
      expect(slowItemFinished).toBe(true);
      expect(task).toHaveBeenCalledTimes(3);

      const experiments = await experimentsStorage.listExperiments({ pagination: { page: 0, perPage: 10 } });
      expect(experiments.experiments[0]).toMatchObject({
        status: 'failed',
        succeededCount: 1,
        failedCount: 0,
        skippedCount: 2,
      });
      const persistedResults = await experimentsStorage.listExperimentResults({
        experimentId: experiments.experiments[0]!.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(persistedResults.results).toHaveLength(1);
      expect(persistedResults.results[0]).toMatchObject({ itemId: 'fast-item' });
    });

    it('preserves fail-fast behavior for non-observer mapper failures when an observer is present', async () => {
      const unserializableOutput = new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('output serialization failed');
          },
        },
      );
      const task = vi.fn(async ({ input }) => (input === 'first' ? unserializableOutput : 'done'));
      const events: ExperimentEvent[] = [];

      const summary = await runExperiment(mastra, {
        data: [
          { id: 'broken-item', input: 'first' },
          { id: 'later-item', input: 'second' },
        ],
        task,
        maxConcurrency: 1,
        onEvent: event => {
          events.push(event);
        },
      });

      expect(summary).toMatchObject({
        status: 'failed',
        succeededCount: 1,
        failedCount: 0,
        skippedCount: 1,
      });
      expect(task).toHaveBeenCalledTimes(1);
      expect(events.map(event => event.type)).toEqual(['experiment.run.started', 'experiment.run.finished']);
      expect(events.at(-1)).toMatchObject({
        status: 'failed',
        error: { message: 'output serialization failed' },
      });
    });

    it('normalizes invalid dates and reports inline task identity in events', async () => {
      const events: ExperimentEvent[] = [];

      await runExperiment(mastra, {
        data: [{ id: 'inline-item', input: { invalidDate: new Date(Number.NaN) } }],
        task: async () => 'done',
        onEvent: event => {
          events.push(event);
        },
      });

      expect(events.every(event => event.target.type === 'task' && event.target.id === 'inline')).toBe(true);
      expect(events.find(event => event.type === 'experiment.item.completed')).toMatchObject({
        input: { invalidDate: null },
      });
      expect(() => JSON.stringify(events)).not.toThrow();
    });

    it('emits item failures and a completed-with-errors terminal outcome', async () => {
      let callCount = 0;
      const flakyAgent = createMockAgent('Response');
      flakyAgent.generate.mockImplementation(async () => {
        if (callCount++ === 0) throw new Error('first item failed');
        return { text: 'Response' };
      });
      const localMastra = {
        ...mastra,
        getAgentById: vi.fn().mockReturnValue(flakyAgent),
      } as unknown as Mastra;
      const events: ExperimentEvent[] = [];

      const summary = await runExperiment(localMastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 1,
        onEvent: event => {
          events.push(event);
        },
      });

      const itemEvents = events.filter(event => event.type === 'experiment.item.completed');
      expect(itemEvents.map(event => event.status)).toEqual(['failed', 'succeeded']);
      expect(itemEvents[0]?.error).toMatchObject({ message: 'first item failed' });
      expect(events.at(-1)).toMatchObject({
        type: 'experiment.run.finished',
        status: 'completed',
        completedWithErrors: true,
      });
      expect(summary.completedWithErrors).toBe(true);
    });

    it('emits cancellation as a terminal failed outcome before final persistence', async () => {
      const controller = new AbortController();
      const events: ExperimentEvent[] = [];
      let storedStatusAtTerminal: string | undefined;

      const summary = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        signal: controller.signal,
        onEvent: async event => {
          events.push(event);
          if (event.type === 'experiment.run.started') controller.abort();
          if (event.type === 'experiment.run.finished') {
            storedStatusAtTerminal = (await experimentsStorage.getExperimentById({ id: event.experimentId }))?.status;
          }
        },
      });

      expect(summary.status).toBe('failed');
      expect(events.map(event => event.type)).toEqual(['experiment.run.started', 'experiment.run.finished']);
      expect(events.at(-1)).toMatchObject({ outcome: 'cancelled', error: { name: 'AbortError' } });
      expect(storedStatusAtTerminal).toBe('running');
      expect((await experimentsStorage.getExperimentById({ id: summary.experimentId }))?.status).toBe('failed');
    });

    it('emits a cancelled outcome when cancellation aborts the final in-flight item', async () => {
      // Cancellation during the last in-flight item is caught as a per-item
      // failure, so the run resolves through the natural-completion path
      // instead of throwing. The terminal outcome must still be `cancelled`.
      // A single-item dataset guarantees no later item hits the pre-item
      // abort check (which would take the thrown-AbortError path instead).
      const singleItemDataset = await datasetsStorage.createDataset({
        name: 'Single Item Dataset',
        description: 'Cancellation during final in-flight item',
      });
      await datasetsStorage.addItem({
        datasetId: singleItemDataset.id,
        input: { prompt: 'Hello' },
      });

      const controller = new AbortController();
      const abortingAgent = createMockAgent('Response');
      abortingAgent.generate.mockImplementation(async () => {
        controller.abort();
        throw new DOMException('Aborted', 'AbortError');
      });
      const localMastra = {
        ...mastra,
        getAgentById: vi.fn().mockReturnValue(abortingAgent),
      } as unknown as Mastra;
      const events: ExperimentEvent[] = [];

      const summary = await runExperiment(localMastra, {
        datasetId: singleItemDataset.id,
        targetType: 'agent',
        targetId: 'test-agent',
        signal: controller.signal,
        onEvent: event => {
          events.push(event);
        },
      });

      expect(summary.status).toBe('failed');
      const finished = events.at(-1);
      expect(finished).toMatchObject({
        type: 'experiment.run.finished',
        status: 'failed',
        outcome: 'cancelled',
      });
    });
  });

  describe('tenancy hydration', () => {
    it('hydrates organizationId and projectId from the parent dataset onto experiment + results', async () => {
      // Create a tenancy-scoped dataset with items
      const tenantDs = await datasetsStorage.createDataset({
        name: 'Tenant Dataset',
        organizationId: 'org_tenant',
        projectId: 'proj_tenant',
      });
      await datasetsStorage.addItem({
        datasetId: tenantDs.id,
        input: { prompt: 'A' },
        groundTruth: { text: 'a' },
      });
      await datasetsStorage.addItem({
        datasetId: tenantDs.id,
        input: { prompt: 'B' },
        groundTruth: { text: 'b' },
      });

      const result = await runExperiment(mastra, {
        datasetId: tenantDs.id,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      const storedRun = await experimentsStorage.getExperimentById({ id: result.experimentId });
      expect(storedRun?.organizationId).toBe('org_tenant');
      expect(storedRun?.projectId).toBe('proj_tenant');

      const persisted = await experimentsStorage.listExperimentResults({
        experimentId: result.experimentId,
        pagination: { page: 0, perPage: 50 },
      });
      expect(persisted.results).toHaveLength(2);
      for (const r of persisted.results) {
        expect(r.organizationId).toBe('org_tenant');
        expect(r.projectId).toBe('proj_tenant');
      }
    });

    it('defaults tenancy to null when the parent dataset has no tenancy bucket', async () => {
      // The default test dataset (set up in beforeEach) has no tenancy
      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
      });

      const storedRun = await experimentsStorage.getExperimentById({ id: result.experimentId });
      expect(storedRun?.organizationId).toBeNull();
      expect(storedRun?.projectId).toBeNull();

      const persisted = await experimentsStorage.listExperimentResults({
        experimentId: result.experimentId,
        pagination: { page: 0, perPage: 50 },
      });
      expect(persisted.results.length).toBeGreaterThan(0);
      for (const r of persisted.results) {
        expect(r.organizationId).toBeNull();
        expect(r.projectId).toBeNull();
      }
    });
  });
});
