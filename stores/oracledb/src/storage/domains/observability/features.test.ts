import { describe, expect, it } from 'vitest';

import { ObservabilityOracle } from '.';

describe('ObservabilityOracle features', () => {
  it('declares logs and the filter discovery it implements', () => {
    const storage = new ObservabilityOracle({ poolManager: {} as any });

    expect(storage.getFeatures()).toEqual([
      'logs',
      'entity-type-discovery',
      'entity-name-discovery',
      'service-name-discovery',
      'environment-discovery',
      'tag-discovery',
    ]);
  });
});
