import { describe, expect, it, vi } from 'vitest';

import { DatasetsLibSQL } from '.';

describe('DatasetsLibSQL snapshot transaction', () => {
  it('preserves the snapshot error when rollback also fails', async () => {
    const snapshotError = new Error('import failed');
    const rollbackError = new Error('rollback failed');
    const tx = {
      closed: false,
      commit: vi.fn(),
      rollback: vi.fn().mockRejectedValue(rollbackError),
      close: vi.fn(),
    };
    const client = { transaction: vi.fn().mockResolvedValue(tx) };
    const datasets = new DatasetsLibSQL({ client: client as never });

    const thrown = await (datasets as any)
      .withSnapshotTransaction(async () => {
        throw snapshotError;
      })
      .catch((error: unknown) => error);

    expect(thrown).toMatchObject({
      message: 'Transaction and rollback both failed',
      errors: [snapshotError, rollbackError],
    });
    expect(tx.commit).not.toHaveBeenCalled();
    expect(tx.close).toHaveBeenCalledOnce();
  });
});
