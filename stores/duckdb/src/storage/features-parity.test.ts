import { coreFeatures } from '@mastra/core/features';
import { describe, expect, it } from 'vitest';
import { DuckDBStore } from '../index';
import { DuckDBConnection } from './db/index';
import { ObservabilityStorageDuckDB } from './domains/observability/index';

describe('DuckDBStore observability features', () => {
  describe.each([false, true])('when delta polling is %s', deltaPolling => {
    it('advertises before init exactly what the observability store supports', async () => {
      const originalFeatures = new Set(coreFeatures);
      const store = new DuckDBStore({ path: ':memory:' });
      try {
        if (deltaPolling) coreFeatures.add('observability-delta-polling');
        else coreFeatures.delete('observability-delta-polling');
        const facade = (await store.getStore('observability'))!;
        const implementation = new ObservabilityStorageDuckDB({ db: new DuckDBConnection({ path: ':memory:' }) });

        expect([...facade.getFeatures()].sort()).toEqual([...implementation.getFeatures()].sort());
        expect(facade.getFeatures()).toContain('span-aggregate');
      } finally {
        coreFeatures.clear();
        for (const feature of originalFeatures) coreFeatures.add(feature);
        await store.close();
      }
    });
  });
});
