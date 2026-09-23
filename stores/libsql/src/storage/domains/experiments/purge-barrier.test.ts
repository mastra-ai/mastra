import { describe, expect, it, vi } from 'vitest';

import { ExperimentsLibSQL } from '.';

describe('ExperimentsLibSQL purge barrier', () => {
  it('preserves the transaction error when rollback also fails', async () => {
    const transactionError = new Error('insert failed');
    const rollbackError = new Error('rollback failed');
    const tx = {
      closed: false,
      execute: vi.fn().mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(transactionError),
      commit: vi.fn(),
      rollback: vi.fn().mockRejectedValue(rollbackError),
      close: vi.fn(),
    };
    const client = {
      transaction: vi.fn().mockResolvedValue(tx),
    };
    const experiments = new ExperimentsLibSQL({ client: client as never });

    let thrown: unknown;
    try {
      await experiments.addExperimentResult({
        experimentId: 'experiment-1',
        itemId: 'item-1',
        itemDatasetVersion: 1,
        input: { patient: 'Alice' },
        output: null,
        groundTruth: null,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      cause: expect.objectContaining({
        message: 'Transaction and rollback both failed',
        errors: [transactionError, rollbackError],
      }),
    });
    expect(tx.close).toHaveBeenCalledOnce();
  });

  it('does not roll back a transaction that is already closed', async () => {
    const transactionError = new Error('commit failed');
    const tx = {
      closed: true,
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      commit: vi.fn().mockRejectedValue(transactionError),
      rollback: vi.fn(),
      close: vi.fn(),
    };
    const client = {
      transaction: vi.fn().mockResolvedValue(tx),
    };
    const experiments = new ExperimentsLibSQL({ client: client as never });

    await expect(
      experiments.addExperimentResult({
        experimentId: 'experiment-1',
        itemId: 'item-1',
        itemDatasetVersion: 1,
        input: null,
        output: null,
        groundTruth: null,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      }),
    ).rejects.toMatchObject({ cause: transactionError });
    expect(tx.rollback).not.toHaveBeenCalled();
    expect(tx.close).toHaveBeenCalledOnce();
  });
});
