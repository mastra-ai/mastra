import { describe, expect, it, vi } from 'vitest';

import { ObservabilitySpanner } from '.';

describe('ObservabilitySpanner retention', () => {
  it('retries an aborted delete when rollback also fails', async () => {
    const aborted = Object.assign(new Error('ABORTED'), { code: 10 });
    const runTransactionAsync = vi
      .fn()
      .mockImplementationOnce(async callback =>
        callback({
          runUpdate: vi.fn().mockRejectedValue(aborted),
          rollback: vi.fn().mockRejectedValue(new Error('rollback failed')),
        }),
      )
      .mockImplementationOnce(async callback =>
        callback({
          runUpdate: vi.fn().mockResolvedValue([0]),
          commit: vi.fn().mockResolvedValue(undefined),
        }),
      );
    const storage = new ObservabilitySpanner({ database: { runTransactionAsync } as any });

    await expect(storage.prune({ spans: { maxAge: 1_000 } })).resolves.toEqual([
      { domain: 'observability', table: 'mastra_ai_spans', deleted: 0, done: true },
    ]);
    expect(runTransactionAsync).toHaveBeenCalledTimes(2);
  });
});
