import { describe, expect, it, vi } from 'vitest';

import type { DbClient, TxClient } from '../../client';
import { WorkflowDefinitionsPG } from './index';

describe('WorkflowDefinitionsPG transaction errors', () => {
  it('preserves the failed statement error without querying the aborted transaction', async () => {
    const persistenceError = new Error('insert failed');
    const transaction = {
      oneOrNone: vi.fn().mockResolvedValueOnce(null),
      query: vi.fn().mockRejectedValue(persistenceError),
    } as unknown as TxClient;
    const client = {
      tx: vi.fn(async callback => callback(transaction)),
    } as unknown as DbClient;
    const store = new WorkflowDefinitionsPG({ client });

    await expect(
      store.upsertMany([
        {
          id: 'workflow',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
          graph: [],
        },
      ]),
    ).rejects.toBe(persistenceError);
    expect(transaction.oneOrNone).toHaveBeenCalledTimes(1);
  });
});
