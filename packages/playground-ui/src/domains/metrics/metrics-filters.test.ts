import { describe, expect, it } from 'vitest';
import {
  METRICS_FILTER_BAR_OPERATORS,
  METRICS_PROPERTY_FILTER_PARAM_BY_FIELD,
  createMetricsFilterBarFields,
  createMetricsPropertyFilterFields,
  filterBarItemsToMetricsTokens,
  metricsTokensToFilterBarItems,
} from './metrics-filters';

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

const noDiscovery = {
  availableTags: [],
  availableEntityNames: [],
  availableServiceNames: [],
  availableEnvironments: [],
};

describe('createMetricsFilterBarFields', () => {
  it('only accepts discovered values for a discovered dimension', () => {
    const fields = createMetricsFilterBarFields({ ...noDiscovery, availableEnvironments: ['production'] });

    const environment = fields.find(field => field.id === 'environment');
    expect(environment?.strict).toBe(true);
    expect(environment?.suggestions).toEqual([{ value: 'production' }]);
  });

  it('does not offer an entityId filter the metrics API ignores', () => {
    const fields = createMetricsFilterBarFields(noDiscovery);

    expect(fields.map(field => field.id)).not.toContain('entityId');
  });

  it('labels provider and model chips without offering them', () => {
    const fields = createMetricsFilterBarFields(noDiscovery);

    const urlOnly = fields.filter(field => field.id === 'provider' || field.id === 'model');
    expect(urlOnly.map(field => [field.label, field.hidden])).toEqual([
      ['Provider', true],
      ['Model', true],
    ]);
  });

  it('lets a Tags filter hold several tags and every other dimension a single value', () => {
    const fields = createMetricsFilterBarFields(noDiscovery);
    const arityOf = (operatorId: string) =>
      METRICS_FILTER_BAR_OPERATORS.find(operator => operator.id === operatorId)?.arity ?? 'one';
    const widens = (operatorId: string) =>
      Boolean(METRICS_FILTER_BAR_OPERATORS.find(operator => operator.id === operatorId)?.widensTo);

    for (const field of fields) {
      const operators = field.operators ?? [];
      expect(operators.map(arityOf)).toEqual(field.id === 'tags' ? ['many'] : ['one']);
      expect(operators.some(widens)).toBe(false);
    }
  });
});

describe('metricsTokensToFilterBarItems', () => {
  it('reads the legacy "Any" value as a chip without a value', () => {
    const [item] = metricsTokensToFilterBarItems([{ fieldId: 'environment', value: 'Any' }]);

    expect(item?.value).toBe('');
  });

  it('keeps the first value of a repeated single-value param, the one the metrics API applies', () => {
    const [item] = metricsTokensToFilterBarItems([{ fieldId: 'entityName', value: ['weather', 'chef'] }]);

    expect(item?.value).toBe('weather');
  });

  it('round-trips through filterBarItemsToMetricsTokens', () => {
    const tokens = [
      { fieldId: 'tags', value: ['beta', 'support'] },
      { fieldId: 'environment', value: 'production' },
      { fieldId: 'threadId', value: '' },
    ];

    expect(filterBarItemsToMetricsTokens(metricsTokensToFilterBarItems(tokens))).toEqual(tokens);
  });
});
