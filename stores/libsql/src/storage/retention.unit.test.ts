import { describe, expect, it, vi } from 'vitest';

import { runPrune } from './retention';

describe('runPrune', () => {
  it('uses one cutoff instant for every target', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValueOnce(10_000).mockReturnValue(20_000);
    const cutoffs: Array<number | string> = [];
    const db = {
      pruneBatch: vi.fn(({ cutoff }) => {
        cutoffs.push(cutoff);
        return Promise.resolve(0);
      }),
    };

    await runPrune({
      db: db as any,
      domain: 'memory',
      targets: [
        { table: 'mastra_messages', column: 'createdAt', indexed: false, policy: { maxAge: 1_000 } },
        { table: 'mastra_threads', column: 'createdAt', indexed: false, policy: { maxAge: 1_000 } },
      ] as any,
    });

    expect(cutoffs).toEqual([new Date(9_000).toISOString(), new Date(9_000).toISOString()]);
    now.mockRestore();
  });
});
