/**
 * Tests for external experiment execution (Tier 1: "bring your own runner").
 *
 * External systems (e.g. Temporal workflows) own execution: they create the
 * experiment, submit per-item results with retry-safe upsert semantics, and
 * finalize. Mastra is the system of record and computes counts server-side.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Mastra } from '../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../storage/base';
import { DatasetsInMemory } from '../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import { Dataset } from '../dataset';
import { compareExperiments } from '../experiment/analytics/compare';

async function setup(inputs: { input: unknown; groundTruth?: unknown }[]) {
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
  } as unknown as Mastra;

  const record = await datasetsStorage.createDataset({ name: 'External Experiments DS' });
  const itemIds: string[] = [];
  for (const item of inputs) {
    const created = await datasetsStorage.addItem({
      datasetId: record.id,
      input: item.input,
      groundTruth: item.groundTruth,
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

describe('createExternalExperiment', () => {
  it('creates a running experiment with targetType external and no runner', async () => {
    const { ds } = await setup(THREE_ITEMS);

    const created = await ds.createExternalExperiment({ name: 'ext-run' });

    expect(created.status).toBe('running');
    expect(created.totalItems).toBe(3);
    const experiment = await ds.getExperiment({ experimentId: created.experimentId });
    expect(experiment?.targetType).toBe('external');
    expect(experiment?.status).toBe('running');
    expect(experiment?.startedAt).toBeTruthy();
  });

  it('is idempotent on a caller-supplied id', async () => {
    const { ds } = await setup(THREE_ITEMS);

    const first = await ds.createExternalExperiment({ id: 'wf-run-123' });
    const second = await ds.createExternalExperiment({ id: 'wf-run-123' });

    expect(second.experimentId).toBe(first.experimentId);
    expect(second.totalItems).toBe(first.totalItems);
    const { experiments } = await ds.listExperiments({});
    expect(experiments).toHaveLength(1);
  });

  it('rejects a caller-supplied id that collides with a non-external experiment', async () => {
    const { ds, experimentsStorage } = await setup(THREE_ITEMS);
    const dsRecord = await ds.getExperiment({ experimentId: 'nope' }); // warm no-op
    void dsRecord;
    await experimentsStorage.createExperiment({
      id: 'taken-id',
      datasetId: (ds as any).id,
      datasetVersion: 1,
      targetType: 'agent',
      targetId: 'agent-1',
      totalItems: 3,
    });

    await expect(ds.createExternalExperiment({ id: 'taken-id' })).rejects.toThrow(/does not match/);
  });

  it('rejects when the dataset has no items', async () => {
    const { ds } = await setup([]);
    await expect(ds.createExternalExperiment({})).rejects.toThrow(/no items/);
  });
});

describe('submitExperimentResult', () => {
  it('retried submissions converge on a single row (upsert on experimentId+itemId+attempt)', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExternalExperiment({});

    const first = await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'v1' });
    const second = await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'v2' });

    expect(second.id).toBe(first.id);
    expect(second.output).toBe('v2');

    const { results } = await ds.listExperimentResults({ experimentId });
    expect(results).toHaveLength(1);
    expect(results[0]!.output).toBe('v2');
  });

  it('keeps separate rows per attempt for repeated trials', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExternalExperiment({});

    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 't0', attempt: 0 });
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 't1', attempt: 1 });

    const { results } = await ds.listExperimentResults({ experimentId });
    expect(results).toHaveLength(2);
  });

  it('defaults input and groundTruth from the dataset item', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExternalExperiment({});

    const result = await ds.submitExperimentResult({ experimentId, itemId: itemIds[1]!, output: 'out' });

    expect(result.input).toBe('q2');
    expect(result.groundTruth).toBe('a2');
  });

  it('persists inline scores keyed by runId = experimentId', async () => {
    const { ds, itemIds, scoresStorage } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExternalExperiment({});

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

  it('rejects unknown item ids', async () => {
    const { ds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExternalExperiment({});
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
    const { experimentId } = await otherDs.createExternalExperiment({});

    await expect(ds.submitExperimentResult({ experimentId, itemId: otherItem.id, output: 'x' })).rejects.toThrow(
      /not found/i,
    );
  });

  it('rejects submissions to a non-external experiment', async () => {
    const { ds, experimentsStorage, itemIds } = await setup(THREE_ITEMS);
    const native = await experimentsStorage.createExperiment({
      datasetId: (ds as any).id,
      datasetVersion: 1,
      targetType: 'agent',
      targetId: 'agent-1',
      totalItems: 3,
    });
    await expect(
      ds.submitExperimentResult({ experimentId: native.id, itemId: itemIds[0]!, output: 'x' }),
    ).rejects.toThrow(/not an external experiment/);
  });

  it('rejects submissions after finalization', async () => {
    const { ds, itemIds } = await setup(THREE_ITEMS);
    const { experimentId } = await ds.createExternalExperiment({});
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
    const { experimentId } = await ds.createExternalExperiment({});

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
    const { experimentId } = await ds.createExternalExperiment({});

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
    const { experimentId } = await ds.createExternalExperiment({});

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
    const { experimentId } = await ds.createExternalExperiment({});
    await ds.submitExperimentResult({ experimentId, itemId: itemIds[0]!, output: 'ok' });

    const first = await ds.finalizeExperiment({ experimentId });
    const second = await ds.finalizeExperiment({ experimentId });

    expect(second.status).toBe('completed');
    expect(second.succeededCount).toBe(first.succeededCount);
    expect(second.completedAt).toEqual(first.completedAt);
  });
});

describe('external experiments integrate with comparison', () => {
  it('two external experiments with inline scores can be compared', async () => {
    const { ds, mastra, itemIds } = await setup(THREE_ITEMS);

    const runA = await ds.createExternalExperiment({ name: 'baseline' });
    const runB = await ds.createExternalExperiment({ name: 'candidate' });

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
