/**
 * Tests for caller-driven experiment execution.
 *
 * Callers (e.g. Temporal workflows) own the loop: they create the experiment,
 * either have Mastra run items (`runExperimentItem`, targeted experiments) or
 * ingest results themselves (`submitExperimentResult`, target-less
 * experiments), and finalize. Mastra is the system of record and computes
 * counts server-side.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Agent } from '../../agent';
import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../storage/base';
import { DatasetsInMemory } from '../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import { Dataset } from '../dataset';
import { compareExperiments } from '../experiment/analytics/compare';

// executeTarget checks the agent's model version; mock it so plain agent mocks work.
vi.mock('../../agent', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, isSupportedLanguageModel: vi.fn().mockReturnValue(true) };
});

const createMockAgent = (response: string, shouldFail = false): Agent =>
  ({
    id: 'test-agent',
    name: 'Test Agent',
    getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
    generate: vi.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error('Agent error');
      return { text: response };
    }),
  }) as unknown as Agent;

const createMockScorer = (scorerId: string, score = 1): MastraScorer<any, any, any, any> =>
  ({
    id: scorerId,
    name: scorerId,
    description: 'Mock scorer',
    run: vi.fn().mockResolvedValue({ score, reason: 'mock' }),
  }) as unknown as MastraScorer<any, any, any, any>;

async function setup(
  inputs: {
    input: unknown;
    groundTruth?: unknown;
    metadata?: Record<string, unknown>;
    expectedTrajectory?: unknown;
    scorerIds?: string[];
  }[],
  opts?: { agent?: Agent; scorers?: MastraScorer<any, any, any, any>[]; datasetScorerIds?: string[] },
) {
  const db = new InMemoryDB();
  const datasetsStorage = new DatasetsInMemory({ db });
  const experimentsStorage = new ExperimentsInMemory({ db });
  const scoresStorage = new ScoresInMemory({ db });

  const mockStorage = {
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

  const mastra = {
    getStorage: vi.fn().mockReturnValue(mockStorage),
    getLogger: vi.fn().mockReturnValue({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
    getAgent: vi.fn().mockImplementation(() => {
      if (!opts?.agent) throw new Error('Agent not found');
      return opts.agent;
    }),
    getAgentById: vi.fn().mockImplementation(() => {
      if (!opts?.agent) throw new Error('Agent not found');
      return opts.agent;
    }),
    getScorerById: vi.fn().mockImplementation((id: string) => opts?.scorers?.find(s => s.id === id) ?? null),
    getWorkflowById: vi.fn(),
    getWorkflow: vi.fn(),
  } as unknown as Mastra;

  const record = await datasetsStorage.createDataset({
    name: 'Caller-driven Experiments DS',
    scorerIds: opts?.datasetScorerIds,
  });
  const itemIds: string[] = [];
  for (const item of inputs) {
    const created = await datasetsStorage.addItem({
      datasetId: record.id,
      input: item.input,
      groundTruth: item.groundTruth,
      metadata: item.metadata,
      expectedTrajectory: item.expectedTrajectory,
      scorerIds: item.scorerIds,
    });
    itemIds.push(created.id);
  }

  return { ds: new Dataset(record.id, mastra), mastra, itemIds, experimentsStorage, scoresStorage };
}

const THREE_ITEMS = [
  { input: 'q1', groundTruth: 'a1' },
  { input: 'q2', groundTruth: 'a2' },
  { input: 'q3', groundTruth: 'a3' },
];

describe('createExperiment', () => {
  it('creates a running target-less experiment with no runner', async () => {
    const { ds } = await setup(THREE_ITEMS);

    const created = await ds.createExperiment({ name: 'ext-run' });

    expect(created.status).toBe('running');
    expect(created.totalItems).toBe(3);
    const experiment = await ds.getExperiment({ experimentId: created.experimentId });
    expect(experiment?.targetType).toBeNull();
    expect(experiment?.targetId).toBeNull();
    expect(experiment?.status).toBe('running');
    expect(experiment?.startedAt).toBeTruthy();
  });

  it('is idempotent on a caller-supplied id', async () => {
    const { ds } = await setup(THREE_ITEMS);

    const first = await ds.createExperiment({ id: 'wf-run-123' });
    const second = await ds.createExperiment({ id: 'wf-run-123' });

    expect(second.experimentId).toBe(first.experimentId);
    expect(second.totalItems).toBe(first.totalItems);
    const { experiments } = await ds.listExperiments({});
    expect(experiments).toHaveLength(1);
  });

  it('rejects a caller-supplied id that collides with an experiment of a different shape', async () => {
    const { ds, experimentsStorage } = await setup(THREE_ITEMS);
    await experimentsStorage.createExperiment({
      id: 'taken-id',
      datasetId: ds.id,
      datasetVersion: 1,
      targetType: 'agent',
      targetId: 'agent-1',
      totalItems: 3,
    });

    await expect(ds.createExperiment({ id: 'taken-id' })).rejects.toThrow(/does not match/);
  });

  it('rejects when the dataset has no items', async () => {
    const { ds } = await setup([]);
    await expect(ds.createExperiment({})).rejects.toThrow(/no items/);
  });
});

describe('submitExperimentResult', () => {
  it('retried submissions converge on a single row (upsert on experimentId+itemId+attempt)', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    const first = await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'v1' });
    const second = await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'v2' });

    expect(second.id).toBe(first.id);
    expect(second.output).toBe('v2');

    const { results } = await ds.listExperimentResults({ experimentId });
    expect(results).toHaveLength(1);
    expect(results[0]!.output).toBe('v2');
  });

  it('snapshots metadata from the pinned dataset item version', async () => {
    const { ds, itemIds } = await setup([{ input: 'q1', metadata: { source: 'original' } }]);
    const { experimentId } = await ds.createExperiment({});

    await ds.updateItem({ itemId: itemIds[0]!, metadata: { source: 'updated' } });
    const result = await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'a1' });

    expect(result.metadata).toEqual({ source: 'original' });
    const { results } = await ds.listExperimentResults({ experimentId });
    expect(results[0]?.metadata).toEqual({ source: 'original' });
  });

  it('keeps separate rows per attempt for repeated trials', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 't0', attempt: 0 });
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 't1', attempt: 1 });

    const { results } = await ds.listExperimentResults({ experimentId });
    expect(results).toHaveLength(2);
  });

  it('defaults input and groundTruth from the dataset item', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    const result = await ds.submitExperimentResult({ experimentId, itemId: itemIds[1]!, output: 'out' });

    expect(result.input).toBe('q2');
    expect(result.groundTruth).toBe('a2');
  });

  it('persists inline scores keyed by runId = experimentId', async () => {
    const { ds, itemIds, scoresStorage } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    await ds.submitExperimentResult({
      experimentId,
      itemId: itemIds[0]!,
      output: 'out',
      scores: [{ scorerId: 'clinical-accuracy', score: 0.9, reason: 'good' }],
    });

    const { scores } = await scoresStorage.listScoresByRunId({
      runId: experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(scores).toHaveLength(1);
    expect(scores[0]!.scorerId).toBe('clinical-accuracy');
    expect(scores[0]!.score).toBe(0.9);
    expect(scores[0]!.entityId).toBe(itemIds[0]);
  });

  it('retried submissions converge on one score per scorer, latest wins', async () => {
    const { ds, itemIds, scoresStorage } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    const submit = (score: number) =>
      ds.submitExperimentResult({
        experimentId,
        itemId: itemIds[0]!,
        output: 'out',
        scores: [{ scorerId: 'clinical-accuracy', score, reason: 'good' }],
      });
    // Worker submits 0.4, times out, retries with an updated 0.8.
    await submit(0.4);
    await submit(0.8);

    const { scores } = await scoresStorage.listScoresByRunId({
      runId: experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(scores).toHaveLength(1);
    expect(scores[0]!.score).toBe(0.8);
  });

  it('distinct attempts keep separate score rows', async () => {
    const { ds, itemIds, scoresStorage } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    await ds.submitExperimentResult({
      experimentId,
      itemId: itemIds[0]!,
      attempt: 0,
      output: 'out',
      scores: [{ scorerId: 'clinical-accuracy', score: 0.4 }],
    });
    await ds.submitExperimentResult({
      experimentId,
      itemId: itemIds[0]!,
      attempt: 1,
      output: 'out',
      scores: [{ scorerId: 'clinical-accuracy', score: 0.8 }],
    });

    const { scores } = await scoresStorage.listScoresByRunId({
      runId: experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(scores.map(s => s.score).sort()).toEqual([0.4, 0.8]);
  });

  it('rejects unknown item ids', async () => {
    const { ds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});
    await expect(ds.submitExperimentResult({ experimentId, itemId: 'missing', output: 'x' })).rejects.toThrow(
      /not found/,
    );
  });

  it('rejects submissions to an experiment owned by another dataset', async () => {
    // Two datasets sharing the same storage: an experiment created on one must
    // not accept submissions through the other dataset's handle.
    const { ds, mastra } = await setup(THREE_ITEMS);
    const datasetsStorage = (await mastra.getStorage()!.getStore('datasets'))!;
    const otherRecord = await (datasetsStorage as DatasetsInMemory).createDataset({ name: 'Other DS' });
    const otherItem = await (datasetsStorage as DatasetsInMemory).addItem({ datasetId: otherRecord.id, input: 'q' });
    const otherDs = new Dataset(otherRecord.id, mastra);
    const { experimentId } = await otherDs.createExperiment({});

    await expect(ds.submitExperimentResult({ experimentId, itemId: otherItem.id, output: 'x' })).rejects.toThrow(
      /not found/i,
    );
  });

  it('rejects submissions to an experiment that has a target', async () => {
    const { ds, experimentsStorage, itemIds } = await setup(THREE_ITEMS);
    const native = await experimentsStorage.createExperiment({
      datasetId: ds.id,
      datasetVersion: 1,
      targetType: 'agent',
      targetId: 'agent-1',
      totalItems: 3,
    });
    await expect(
      ds.submitExperimentResult({ experimentId: native.id, itemId: itemIds[0]!, output: 'x' }),
    ).rejects.toThrow(/has a target/);
  });

  it('rejects submissions after finalization', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'x' });
    await ds.finalizeExperiment({ experimentId });

    await expect(ds.submitExperimentResult({ experimentId, itemId: itemIds[1]!, output: 'y' })).rejects.toThrow(
      /already completed/,
    );
  });
});

describe('finalizeExperiment', () => {
  it('computes succeeded/failed/skipped counts server-side', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'ok' });
    await ds.submitExperimentResult({
      experimentId,
      itemId: itemIds[1]!,
      error: { message: 'boom' },
    });
    // itemIds[2] never submitted -> skipped

    const finalized = await ds.finalizeExperiment({ experimentId });

    expect(finalized.status).toBe('completed');
    expect(finalized.succeededCount).toBe(1);
    expect(finalized.failedCount).toBe(1);
    expect(finalized.skippedCount).toBe(1);
    expect(finalized.completedAt).toBeTruthy();
  });

  it('counts per item, not per row: succeeded + failed + skipped === totalItems with trials', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    // Item 0: two trials, both succeed -> one succeeded item.
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, attempt: 0, output: 'trial-0' });
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, attempt: 1, output: 'trial-1' });
    // Item 1: one failed trial, one succeeded trial -> succeeded (any attempt).
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[1]!, attempt: 0, error: { message: 'boom' } });
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[1]!, attempt: 1, output: 'recovered' });
    // Item 2 never submitted -> skipped.

    const finalized = await ds.finalizeExperiment({ experimentId });

    expect(finalized.succeededCount).toBe(2);
    expect(finalized.failedCount).toBe(0);
    expect(finalized.skippedCount).toBe(1);
    expect(finalized.succeededCount! + finalized.failedCount! + finalized.skippedCount!).toBe(finalized.totalItems);
  });

  it('marks an item failed only when every attempt errored', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, attempt: 0, error: { message: 'boom' } });
    await ds.submitExperimentResult({
      experimentId,
      itemId: itemIds[0]!,
      attempt: 1,
      error: { message: 'boom again' },
    });
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[1]!, output: 'ok' });
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[2]!, output: 'ok' });

    const finalized = await ds.finalizeExperiment({ experimentId });

    expect(finalized.succeededCount).toBe(2);
    expect(finalized.failedCount).toBe(1);
    expect(finalized.skippedCount).toBe(0);
  });

  it('is idempotent', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'ok' });

    const first = await ds.finalizeExperiment({ experimentId });
    const second = await ds.finalizeExperiment({ experimentId });

    expect(second.status).toBe('completed');
    expect(second.succeededCount).toBe(first.succeededCount);
    expect(second.completedAt).toEqual(first.completedAt);
  });
});

describe('caller-driven experiments integrate with comparison', () => {
  it('two ingestion experiments with inline scores can be compared', async () => {
    const { ds, mastra, itemIds } = await setup(THREE_ITEMS);

    const runA = await ds.createExperiment({ name: 'baseline' });
    const runB = await ds.createExperiment({ name: 'candidate' });

    for (const itemId of itemIds) {
      await ds.submitExperimentResult({
        experimentId: runA.experimentId,
        itemId,
        output: `A:${itemId}`,
        scores: [{ scorerId: 'accuracy', score: 0.8 }],
      });
      await ds.submitExperimentResult({
        experimentId: runB.experimentId,
        itemId,
        output: `B:${itemId}`,
        scores: [{ scorerId: 'accuracy', score: 0.9 }],
      });
    }
    await ds.finalizeExperiment({ experimentId: runA.experimentId });
    await ds.finalizeExperiment({ experimentId: runB.experimentId });

    const comparison = await compareExperiments(mastra, {
      experimentIdA: runA.experimentId,
      experimentIdB: runB.experimentId,
    });

    expect(comparison.items).toHaveLength(3);
    expect(comparison.scorers['accuracy']).toBeDefined();
    expect(comparison.scorers['accuracy']!.delta).toBeCloseTo(0.1);
  });
});

describe('runExperimentItem (mode 2: caller drives loop, Mastra runs items)', () => {
  it('executes the registered agent, runs experiment-level scorers, and upserts the row', async () => {
    const agent = createMockAgent('agent answer');
    const scorer = createMockScorer('accuracy', 0.75);
    const { ds, itemIds } = await setup(THREE_ITEMS, { agent, scorers: [scorer] });

    const { experimentId } = await ds.createExperiment({
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: ['accuracy'],
    });

    const { result, scores } = await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });

    expect(result.experimentId).toBe(experimentId);
    expect(result.itemId).toBe(itemIds[0]);
    expect(result.output).toMatchObject({ text: 'agent answer' });
    expect(result.error).toBeNull();
    expect(scores).toHaveLength(1);
    expect(scores[0]).toMatchObject({ scorerId: 'accuracy', score: 0.75 });
    expect(scorer.run).toHaveBeenCalledTimes(1);

    const listed = await ds.listExperimentResults({ experimentId });
    expect(listed.results).toHaveLength(1);
  });

  it("forwards the dataset item's expectedTrajectory to scorers", async () => {
    const agent = createMockAgent('agent answer');
    const scorer = createMockScorer('trajectory');
    const expectedTrajectory = { steps: [{ toolId: 'search', arguments: { query: 'q1' } }] };
    const { ds, itemIds } = await setup([{ input: 'q1', groundTruth: 'a1', expectedTrajectory }], {
      agent,
      scorers: [scorer],
    });

    const { experimentId } = await ds.createExperiment({
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: ['trajectory'],
    });

    await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });

    expect(scorer.run).toHaveBeenCalledWith(expect.objectContaining({ expectedTrajectory }));
  });

  it('passes undefined expectedTrajectory when the item has none', async () => {
    const agent = createMockAgent('agent answer');
    const scorer = createMockScorer('trajectory');
    const { ds, itemIds } = await setup([{ input: 'q1', groundTruth: 'a1' }], { agent, scorers: [scorer] });

    const { experimentId } = await ds.createExperiment({
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: ['trajectory'],
    });

    await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });

    expect(scorer.run).toHaveBeenCalledWith(expect.objectContaining({ expectedTrajectory: undefined }));
  });

  it('retried call with the same attempt converges on a single row', async () => {
    const agent = createMockAgent('answer');
    const { ds, itemIds } = await setup(THREE_ITEMS, { agent });
    const { experimentId } = await ds.createExperiment({ targetType: 'agent', targetId: 'test-agent' });

    const first = await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });
    const second = await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });

    expect(second.result.id).toBe(first.result.id);
    const listed = await ds.listExperimentResults({ experimentId });
    expect(listed.results).toHaveLength(1);
  });

  it('retried call converges scores on one row per scorer', async () => {
    const agent = createMockAgent('answer');
    const scorer = createMockScorer('accuracy', 0.75);
    const { ds, itemIds, scoresStorage } = await setup(THREE_ITEMS, { agent, scorers: [scorer] });
    const { experimentId } = await ds.createExperiment({
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: ['accuracy'],
    });

    await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });
    await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });

    const { scores } = await scoresStorage.listScoresByRunId({
      runId: experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(scores).toHaveLength(1);
    expect(scores[0]!.score).toBe(0.75);
  });

  it('separates rows per attempt for repeated trials', async () => {
    const agent = createMockAgent('answer');
    const { ds, itemIds } = await setup(THREE_ITEMS, { agent });
    const { experimentId } = await ds.createExperiment({ targetType: 'agent', targetId: 'test-agent' });

    await ds.runExperimentItem({ experimentId, itemId: itemIds[0]!, attempt: 0 });
    await ds.runExperimentItem({ experimentId, itemId: itemIds[0]!, attempt: 1 });

    const listed = await ds.listExperimentResults({ experimentId });
    expect(listed.results).toHaveLength(2);
  });

  it('captures agent errors on the row instead of throwing', async () => {
    const agent = createMockAgent('unused', true);
    const { ds, itemIds } = await setup(THREE_ITEMS, { agent });
    const { experimentId } = await ds.createExperiment({ targetType: 'agent', targetId: 'test-agent' });

    const { result } = await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });

    expect(result.error).toMatchObject({ message: expect.stringContaining('Agent error') });
    expect(result.output).toBeNull();
  });

  it('falls back to item scorerIds, then dataset scorerIds, when the experiment has no scorers', async () => {
    const agent = createMockAgent('answer');
    const itemScorer = createMockScorer('item-scorer', 0.5);
    const datasetScorer = createMockScorer('dataset-scorer', 0.25);
    const { ds, itemIds } = await setup([{ input: 'q1', scorerIds: ['item-scorer'] }, { input: 'q2' }], {
      agent,
      scorers: [itemScorer, datasetScorer],
      datasetScorerIds: ['dataset-scorer'],
    });
    const { experimentId } = await ds.createExperiment({ targetType: 'agent', targetId: 'test-agent' });

    const itemRun = await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });
    expect(itemRun.scores.map(s => s.scorerId)).toEqual(['item-scorer']);

    const datasetRun = await ds.runExperimentItem({ experimentId, itemId: itemIds[1]! });
    expect(datasetRun.scores.map(s => s.scorerId)).toEqual(['dataset-scorer']);
  });

  it('experiment-level scorers take precedence over item and dataset scorerIds', async () => {
    const agent = createMockAgent('answer');
    const runScorer = createMockScorer('run-scorer', 1);
    const itemScorer = createMockScorer('item-scorer', 0.5);
    const { ds, itemIds } = await setup([{ input: 'q1', scorerIds: ['item-scorer'] }], {
      agent,
      scorers: [runScorer, itemScorer],
      datasetScorerIds: ['item-scorer'],
    });
    const { experimentId } = await ds.createExperiment({
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: ['run-scorer'],
    });

    const { scores } = await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });

    expect(scores.map(s => s.scorerId)).toEqual(['run-scorer']);
    expect(itemScorer.run).not.toHaveBeenCalled();
  });

  it('rejects target-less experiments', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExperiment({});

    await expect(ds.runExperimentItem({ experimentId, itemId: itemIds[0]! })).rejects.toThrow(/has no target/);
  });

  it('rejects finalized experiments', async () => {
    const agent = createMockAgent('answer');
    const { ds, itemIds } = await setup(THREE_ITEMS, { agent });
    const { experimentId } = await ds.createExperiment({ targetType: 'agent', targetId: 'test-agent' });
    await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });
    await ds.finalizeExperiment({ experimentId });

    await expect(ds.runExperimentItem({ experimentId, itemId: itemIds[1]! })).rejects.toThrow(/already completed/);
  });

  it('rejects items not visible at the pinned dataset version', async () => {
    const agent = createMockAgent('answer');
    const { ds, itemIds } = await setup(THREE_ITEMS, { agent });
    const { experimentId } = await ds.createExperiment({ targetType: 'agent', targetId: 'test-agent' });

    await expect(ds.runExperimentItem({ experimentId, itemId: 'nonexistent-item' })).rejects.toThrow(/not found/i);
    expect(itemIds).toHaveLength(3);

    // An item added AFTER the experiment pinned its dataset version exists in
    // the dataset, but is not visible at the pinned version — SCD-2 semantics.
    const lateItem = await ds.addItem({ input: 'late question', groundTruth: 'late answer' });
    await expect(ds.runExperimentItem({ experimentId, itemId: lateItem.id })).rejects.toThrow(/not found/i);
  });

  it('finalize counts targeted-run items the same as ingested ones', async () => {
    const agent = createMockAgent('answer');
    const { ds, itemIds } = await setup(THREE_ITEMS, { agent });
    const { experimentId } = await ds.createExperiment({ targetType: 'agent', targetId: 'test-agent' });

    await ds.runExperimentItem({ experimentId, itemId: itemIds[0]! });
    await ds.runExperimentItem({ experimentId, itemId: itemIds[1]! });
    // itemIds[2] never run -> skipped

    const finalized = await ds.finalizeExperiment({ experimentId });

    expect(finalized.succeededCount).toBe(2);
    expect(finalized.failedCount).toBe(0);
    expect(finalized.skippedCount).toBe(1);
  });
});
