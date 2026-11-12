import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../../storage/mock';
import { markRunAsleep, runWakeKey } from '.';

describe('markRunAsleep', () => {
  // Two sleeps in parallel branches of one run: recovery must leave the run alone until the later one wakes.
  it.each([
    { order: 'the later sleep first', laterFirst: true, together: false },
    { order: 'the earlier sleep first', laterFirst: false, together: false },
    { order: 'the later sleep first, both at once', laterFirst: true, together: true },
    { order: 'the earlier sleep first, both at once', laterFirst: false, together: true },
  ])('keeps the wake key live until the later of two wake times, with $order', async ({ laterFirst, together }) => {
    const store = (await new InMemoryStore().getStore('workflows'))!;
    const runs = [{ runId: 'run', store }];
    const later = Date.now() + 60_000;
    const earlier = Date.now() + 30_000;
    const wakeTimes = laterFirst ? [later, earlier] : [earlier, later];

    if (together) {
      await Promise.all(wakeTimes.map(wakeAt => markRunAsleep({ runs, wakeAt })));
    } else {
      for (const wakeAt of wakeTimes) {
        await markRunAsleep({ runs, wakeAt });
      }
    }

    const record = await store.getRunOwnership({ runId: runWakeKey('run') });
    expect(record?.live).toBe(true);
    // The lease runs from when the write started, so it can end a few milliseconds early.
    expect(record!.leaseExpiresAt!.getTime()).toBeGreaterThan(later - 1_000);
  });
});
