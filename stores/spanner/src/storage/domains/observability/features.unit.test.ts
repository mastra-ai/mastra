import { describe, expect, it } from 'vitest';

import { ObservabilitySpanner } from '.';

describe('ObservabilitySpanner features', () => {
  it('declares no optional features while metrics are disabled (the default)', () => {
    const storage = new ObservabilitySpanner({ database: {} as any });

    expect(storage.getFeatures()).toEqual([]);
  });

  it('declares metrics and metric discovery once metrics are enabled', () => {
    const storage = new ObservabilitySpanner({ database: {} as any, disableMetrics: false });

    expect(storage.getFeatures()).toEqual(['metrics', 'metric-discovery']);
  });
});
