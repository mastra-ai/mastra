import { describe, expect, it } from 'vitest';
import { METRICS_PROPERTY_FILTER_PARAM_BY_FIELD, createMetricsPropertyFilterFields } from './metrics-filters';

describe('createMetricsPropertyFilterFields', () => {
  it('does not offer an entityId filter the metrics API ignores', () => {
    const fields = createMetricsPropertyFilterFields({
      availableTags: [],
      availableEntityNames: [],
      availableServiceNames: [],
      availableEnvironments: [],
    });
    expect(fields.map(field => field.id)).not.toContain('entityId');
    expect(Object.keys(METRICS_PROPERTY_FILTER_PARAM_BY_FIELD)).not.toContain('entityId');
  });
});
