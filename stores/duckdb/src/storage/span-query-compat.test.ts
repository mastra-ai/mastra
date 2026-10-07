import { coreFeatures } from '@mastra/core/features';
import { expect, it, vi } from 'vitest';
import { DuckDBStore } from '../index';

vi.mock('@mastra/core/storage', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/core/storage')>()),
  planSpanQuery: undefined,
}));

it.each([false, true])('does not advertise span queries with older core (delta polling: %s)', async deltaPolling => {
  const originalFeatures = new Set(coreFeatures);
  const store = new DuckDBStore({ path: ':memory:' });
  try {
    if (deltaPolling) coreFeatures.add('observability-delta-polling');
    else coreFeatures.delete('observability-delta-polling');
    const storage = (await store.getStore('observability'))!;
    expect(storage.getFeatures()).not.toContain('span-query');
    await storage.init();
    expect(storage.getFeatures()).not.toContain('span-query');
  } finally {
    coreFeatures.clear();
    for (const feature of originalFeatures) coreFeatures.add(feature);
    await store.close();
  }
});
