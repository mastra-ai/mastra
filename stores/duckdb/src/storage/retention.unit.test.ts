import { describe, expect, it, vi } from 'vitest';

import { runPrune } from './retention';

describe('runPrune', () => {
  it('uses one cutoff instant for every target', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValueOnce(10_000).mockReturnValue(20_000);
    const cutoffs: Date[] = [];
    const db = {
      pruneBatch: vi.fn(({ cutoff }) => {
        cutoffs.push(cutoff);
        return Promise.resolve(0);
      }),
    };

    await runPrune({
      db: db as any,
      domain: 'observability',
      targets: [
        { table: 'span_events', column: 'timestamp', indexed: false, policy: { maxAge: 1_000 } },
        { table: 'log_events', column: 'timestamp', indexed: false, policy: { maxAge: 1_000 } },
      ],
    });

    expect(cutoffs.map(cutoff => cutoff.getTime())).toEqual([9_000, 9_000]);
    now.mockRestore();
  });
});
