import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../storage/base';
import { DatasetsInMemory } from '../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import { Dataset } from '../dataset';

const createMockScorer = (scorerId: string, scorerName: string): MastraScorer<any, any, any, any> => ({
  id: scorerId,
  name: scorerName,
  description: 'Mock scorer',
  run: vi.fn().mockImplementation(async ({ output }: { output: unknown }) => ({
    score: output ? 1.0 : 0.0,
    reason: output ? 'Has output' : 'No output',
  })),
});

const createMockAgent = (response: string, shouldFail = false) => ({
  id: 'test-agent',
  name: 'Test Agent',
  getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
  generate: vi.fn().mockImplementation(async () => {
    if (shouldFail) throw new Error('Agent error');
    return { text: response };
  }),
});

describe('Experiment (via Dataset)', () => {
  let db: InMemoryDB;
  let datasetsStorage: DatasetsInMemory;
  let experimentsStorage: ExperimentsInMemory;
  let scoresStorage: ScoresInMemory;
  let mockStorage: MastraCompositeStore;
  let mastra: Mastra;
  let ds: Dataset;
  let datasetId: string;

  beforeEach(async () => {
    db = new InMemoryDB();
    datasetsStorage = new DatasetsInMemory({ db });
    experimentsStorage = new ExperimentsInMemory({ db });
    scoresStorage = new ScoresInMemory({ db });

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

    const mockAgent = createMockAgent('Response');
    mastra = {
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getAgent: vi.fn().mockReturnValue(mockAgent),
      getAgentById: vi.fn().mockReturnValue(mockAgent),
      getScorerById: vi.fn(),
      getWorkflowById: vi.fn(),
      getWorkflow: vi.fn(),
    } as unknown as Mastra;

    const record = await datasetsStorage.createDataset({ name: 'Experiment DS' });
    datasetId = record.id;

    await datasetsStorage.addItem({
      datasetId,
      input: { prompt: 'Hello' },
      groundTruth: { text: 'Hi' },
      metadata: { source: 'test' },
    });
    await datasetsStorage.addItem({
      datasetId,
      input: { prompt: 'Goodbye' },
      groundTruth: { text: 'Bye' },
      metadata: { source: 'test' },
    });

    ds = new Dataset(datasetId, mastra);
  });

  // 1. Inline task via dataset — basic
  it('inline task completes successfully', async () => {
    const scorer = createMockScorer('acc', 'Accuracy');
    const result = await ds.startExperiment({
      task: async ({ input }) => 'processed-' + JSON.stringify(input),
      scorers: [scorer],
    });

    expect(result.status).toBe('completed');
    expect(result.totalItems).toBe(2);
    expect(result.succeededCount).toBe(2);
  });

  // 2. Inline task with generic type params
  it('inline task with generic type params compiles and completes', async () => {
    interface QA {
      prompt: string;
    }
    interface Answer {
      text: string;
    }

    const result = await ds.startExperiment<QA, string, Answer>({
      task: async ({ input }) => 'answer-' + (input as QA).prompt,
      scorers: [],
    });

    expect(result.status).toBe('completed');
    expect(result.totalItems).toBe(2);
  });

  // 3. Inline task receives mastra argument
  it('inline task receives the mastra instance', async () => {
    let capturedMastra: unknown = null;
    await ds.startExperiment({
      task: async ({ mastra: m }) => {
        capturedMastra = m;
        return 'ok';
      },
      scorers: [],
    });

    expect(capturedMastra).toBe(mastra);
  });

  // 4. Inline task receives groundTruth, metadata, signal
  it('inline task receives groundTruth, metadata, and signal', async () => {
    const captured: Array<{
      groundTruth: unknown;
      metadata: unknown;
      signal: unknown;
    }> = [];

    await ds.startExperiment({
      task: async ({ groundTruth, metadata, signal }) => {
        captured.push({ groundTruth, metadata, signal });
        return 'ok';
      },
      scorers: [],
    });

    expect(captured.length).toBe(2);
    // At least one should have groundTruth and metadata
    const withGt = captured.find(c => c.groundTruth != null);
    expect(withGt).toBeDefined();
    expect(withGt!.groundTruth).toBeDefined();
    expect(withGt!.metadata).toBeDefined();
  });

  // 5. Inline task returns synchronous value
  it('inline task can return a synchronous value', async () => {
    const result = await ds.startExperiment({
      task: ({ input }) => 'sync-' + JSON.stringify(input),
      scorers: [],
    });

    expect(result.status).toBe('completed');
    expect(result.succeededCount).toBe(2);
  });

  // 6. Scorer receives groundTruth from dataset items
  it('scorer receives groundTruth (not expectedOutput)', async () => {
    const spyScorer: MastraScorer<any, any, any, any> = {
      id: 'spy',
      name: 'Spy Scorer',
      description: 'Captures args',
      run: vi.fn().mockImplementation(async () => ({
        score: 1.0,
        reason: 'ok',
      })),
    };

    await ds.startExperiment({
      task: async () => 'output',
      scorers: [spyScorer],
    });

    // Check that scorer.run was called with groundTruth
    const calls = (spyScorer.run as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(2);
    // Each call should have groundTruth in the args
    const firstCallArgs = calls[0]![0] as Record<string, unknown>;
    expect(firstCallArgs).toHaveProperty('groundTruth');
    expect(firstCallArgs.groundTruth).toBeDefined();
  });

  // 7. Task error isolation
  it('isolates task errors — other items still succeed', async () => {
    // Add a third item
    await datasetsStorage.addItem({
      datasetId,
      input: { prompt: 'Third' },
      groundTruth: { text: 'Three' },
    });

    let callCount = 0;
    const result = await ds.startExperiment({
      task: async () => {
        callCount++;
        if (callCount === 1) throw new Error('Task error');
        return 'ok';
      },
      scorers: [],
      maxConcurrency: 1, // Sequential to ensure order
    });

    expect(result.succeededCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.completedWithErrors).toBe(true);
  });

  // 8. Scorer error isolation
  it('isolates scorer errors — experiment still succeeds', async () => {
    const failingScorer: MastraScorer<any, any, any, any> = {
      id: 'failing',
      name: 'Failing Scorer',
      description: 'Always fails',
      run: vi.fn().mockRejectedValue(new Error('Scorer crashed')),
    };
    const passingScorer = createMockScorer('passing', 'Passing');

    const result = await ds.startExperiment({
      task: async () => 'output',
      scorers: [failingScorer, passingScorer],
    });

    expect(result.status).toBe('completed');
    expect(result.succeededCount).toBe(2);

    // Check that failing scorer has error and passing scorer has score
    const itemResult = result.results[0]!;
    const failingScore = itemResult.scores.find(s => s.scorerId === 'failing');
    const passingScore = itemResult.scores.find(s => s.scorerId === 'passing');
    expect(failingScore?.error).toBeTruthy();
    expect(passingScore?.score).toBe(1.0);
  });

  // 9. Backward compat — targetType + targetId
  it('supports targetType + targetId for backward compatibility', async () => {
    const mockAgent = createMockAgent('Agent Response');
    (mastra.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);
    (mastra.getAgentById as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);

    const result = await ds.startExperiment({
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: [],
    });

    expect(result.status).toBe('completed');
    expect(mockAgent.generate).toHaveBeenCalled();
  });

  // 10. Result persistence
  it('persists results that can be retrieved via listExperimentResults', async () => {
    const scorer = createMockScorer('acc', 'Accuracy');
    const summary = await ds.startExperiment({
      task: async ({ input }) => 'output-' + JSON.stringify(input),
      scorers: [scorer],
    });

    const { results } = await ds.listExperimentResults({
      experimentId: summary.experimentId,
    });

    expect(results.length).toBeGreaterThan(0);
    const r = results[0]!;
    expect(r.input).toBeDefined();
    expect(r.output).toBeDefined();
    expect(r.groundTruth).toBeDefined();
  });

  // 11. experimentId field — returned experimentId is a valid UUID string
  it('returns a valid UUID-like experimentId', async () => {
    const result = await ds.startExperiment({
      task: async () => 'ok',
      scorers: [],
    });

    expect(typeof result.experimentId).toBe('string');
    // UUID format: 8-4-4-4-12 hex chars
    expect(result.experimentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
