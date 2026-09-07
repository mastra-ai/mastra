import { describe, expect, it, vi } from 'vitest';

import { DatasetsSpanner } from './datasets';
import { ExperimentsSpanner } from './experiments';

function createTransaction(runResults: unknown[][]) {
  return {
    run: vi.fn().mockImplementation(async () => [runResults.shift() ?? []]),
    runUpdate: vi.fn().mockResolvedValue([1]),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };
}

function createDatabase(transaction: ReturnType<typeof createTransaction>, runResults: unknown[][] = []) {
  return {
    run: vi.fn().mockImplementation(async () => [runResults.shift() ?? []]),
    runTransactionAsync: vi.fn().mockImplementation(async callback => callback(transaction)),
  };
}

describe('Spanner dataset purge barrier', () => {
  it('mutates the dataset row before purging item and experiment-result content', async () => {
    const transaction = createTransaction([[{ id: 'item-1' }]]);
    const database = createDatabase(transaction, [[{ c: 2 }]]);
    const datasets = new DatasetsSpanner({ database: database as never });

    await (datasets as any)._doPurgeItem({ id: 'item-1', datasetId: 'dataset-1' });

    const barrier = transaction.runUpdate.mock.calls[0]?.[0];
    expect(barrier.sql).toContain('UPDATE `mastra_datasets`');
    expect(barrier.sql).toContain('SET `version` = `version`');
    expect(barrier.params).toEqual({ datasetId: 'dataset-1' });
    expect(transaction.runUpdate).toHaveBeenCalledTimes(3);
  });

  it('mutates the same dataset row before checking whether result content must remain redacted', async () => {
    const purgedAt = '2026-09-07T00:00:00.000Z';
    const transaction = createTransaction([[{ datasetId: 'dataset-1' }], [{ metadata: { __purged: true, purgedAt } }]]);
    const database = createDatabase(transaction);
    const experiments = new ExperimentsSpanner({ database: database as never });

    const result = await experiments.addExperimentResult({
      experimentId: 'experiment-1',
      itemId: 'item-1',
      itemDatasetVersion: 1,
      input: { patient: 'Alice' },
      output: { diagnosis: 'secret' },
      groundTruth: { expected: 'private' },
      error: null,
      startedAt: new Date('2026-09-07T00:00:00.000Z'),
      completedAt: new Date('2026-09-07T00:00:01.000Z'),
      retryCount: 0,
    });

    const barrier = transaction.runUpdate.mock.calls[0]?.[0];
    expect(barrier.sql).toContain('UPDATE `mastra_datasets`');
    expect(barrier.sql).toContain('SET `version` = `version`');
    expect(barrier.params).toEqual({ datasetId: 'dataset-1' });
    expect(result).toMatchObject({
      input: null,
      output: null,
      metadata: { __purged: true, purgedAt },
    });
    expect(transaction.runUpdate).toHaveBeenCalledTimes(2);
  });
});
