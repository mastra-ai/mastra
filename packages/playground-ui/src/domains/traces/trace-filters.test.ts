// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyTracePropertyFilterTokens,
  createTraceFilterBarFields,
  filterBarItemsToTraceTokens,
  getPreservedTraceFilterParams,
  getTracePropertyFilterTokens,
  hasAnyTraceFilterParams,
  loadTraceFiltersFromStorage,
  saveTraceFiltersToStorage,
  traceTokensToFilterBarItems,
} from './trace-filters';

const KEY = 'test:traces:saved-filters';

describe('saveTraceFiltersToStorage', () => {
  beforeEach(() => localStorage.clear());

  it('persists filters together with a relative date preset', () => {
    saveTraceFiltersToStorage(new URLSearchParams('status=error&datePreset=last-7d'), KEY);

    expect(loadTraceFiltersFromStorage(KEY)?.toString()).toBe('status=error&datePreset=last-7d');
  });

  it('never persists a custom date range, since absolute dates go stale', () => {
    saveTraceFiltersToStorage(
      new URLSearchParams('status=error&datePreset=custom&dateFrom=2026-01-01&dateTo=2026-01-02'),
      KEY,
    );

    expect(loadTraceFiltersFromStorage(KEY)?.toString()).toBe('status=error');
  });

  it('clears the saved set when no filter is left', () => {
    saveTraceFiltersToStorage(new URLSearchParams('status=error'), KEY);
    saveTraceFiltersToStorage(new URLSearchParams('traceId=abc'), KEY);

    expect(loadTraceFiltersFromStorage(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('createTraceFilterBarFields', () => {
  const fields = createTraceFilterBarFields({
    availableRootEntityNames: ['weather-agent'],
    availableEnvironments: ['prod'],
    hiddenFieldIds: ['rootEntityType', 'entityId'],
  });
  const byId = (id: string) => fields.find(f => f.id === id);

  it('marks the given field ids as hidden', () => {
    expect(byId('rootEntityType')?.hidden).toBe(true);
    expect(byId('entityId')?.hidden).toBe(true);
    expect(byId('traceId')?.hidden).toBeUndefined();
  });

  it('omits fields the query API cannot filter on', () => {
    expect(byId('runId')).toBeUndefined();
    expect(byId('serviceName')).toBeUndefined();
    expect(byId('tags')).toBeUndefined();
  });

  it('does not suggest the unsupported running status', () => {
    const suggestions = byId('status')?.suggestions;
    expect(Array.isArray(suggestions) && suggestions.map(s => s.value)).toEqual(['success', 'error']);
  });

  it('uses the single is operator on every field', () => {
    expect(fields.every(f => f.operators.length === 1 && f.operators[0] === 'is')).toBe(true);
  });

  it('lists picker fields before free-text fields, alphabetically', () => {
    expect(fields.map(f => f.id)).toEqual([
      'environment',
      'entityName',
      'rootEntityType',
      'status',
      'entityId',
      'resourceId',
      'threadId',
      'traceId',
    ]);
  });

  describe('when discovered metadata fields are provided', () => {
    const suggestions = async () => [{ value: 'eu-west' }];
    const withMetadata = createTraceFilterBarFields({
      availableRootEntityNames: [],
      availableEnvironments: [],
      metadataFields: [
        { path: 'metadata.tenant', suggestions },
        { path: 'metadata.region', suggestions },
        { path: 'notMetadata', suggestions },
      ],
    });

    it('appends them after the fixed fields, sorted by key, labelled without the prefix', () => {
      const metadataFields = withMetadata.filter(f => f.id.startsWith('metadata.'));
      expect(metadataFields.map(f => [f.id, f.label])).toEqual([
        ['metadata.region', 'region'],
        ['metadata.tenant', 'tenant'],
      ]);
      expect(withMetadata.at(-1)?.id).toBe('metadata.tenant');
    });

    it('wires the lazy suggestions resolver and keeps them free-text', () => {
      const region = withMetadata.find(f => f.id === 'metadata.region');
      expect(region?.suggestions).toBe(suggestions);
      expect(region?.strict).toBeUndefined();
      expect(region?.operators).toEqual(['is']);
    });

    it('ignores paths outside the metadata namespace', () => {
      expect(withMetadata.find(f => f.id === 'notMetadata')).toBeUndefined();
    });
  });
});

describe('metadata filter URL params', () => {
  it('reads filterMetadata.<key> params as metadata.<key> tokens in insertion order', () => {
    const params = new URLSearchParams('filterMetadata.region=eu-west&filterTraceId=abc&filterMetadata.tenant=acme');

    expect(getTracePropertyFilterTokens(params)).toEqual([
      { fieldId: 'metadata.region', value: 'eu-west' },
      { fieldId: 'traceId', value: 'abc' },
      { fieldId: 'metadata.tenant', value: 'acme' },
    ]);
  });

  it('writes metadata tokens as filterMetadata.<key> params and drops stale ones', () => {
    const params = new URLSearchParams('filterMetadata.stale=x&status=error');

    applyTracePropertyFilterTokens(params, [{ fieldId: 'metadata.region', value: ' eu-west ' }]);

    expect(params.get('filterMetadata.region')).toBe('eu-west');
    expect(params.has('filterMetadata.stale')).toBe(false);
  });

  it('preserves filterMetadata.<key> params for storage persistence', () => {
    const preserved = getPreservedTraceFilterParams(
      new URLSearchParams('filterMetadata.region=eu-west&filterMetadata.empty=&page=2'),
    );

    expect(preserved.get('filterMetadata.region')).toBe('eu-west');
    expect(preserved.has('filterMetadata.empty')).toBe(false);
    expect(preserved.has('page')).toBe(false);
  });

  it('counts a filterMetadata.<key> param as an existing filter so hydration does not re-append it', () => {
    expect(hasAnyTraceFilterParams(new URLSearchParams('filterMetadata.region=eu-west'))).toBe(true);
    expect(hasAnyTraceFilterParams(new URLSearchParams('page=2'))).toBe(false);
  });
});

describe('traceTokensToFilterBarItems', () => {
  it('maps each token to one item keyed by field id, preserving order', () => {
    expect(
      traceTokensToFilterBarItems([
        { fieldId: 'traceId', value: 'abc' },
        { fieldId: 'status', value: 'error' },
      ]),
    ).toEqual([
      { id: 'traceId', fieldId: 'traceId', operatorId: 'is', value: 'abc' },
      { id: 'status', fieldId: 'status', operatorId: 'is', value: 'error' },
    ]);
  });

  it('maps tags to the in operator', () => {
    expect(traceTokensToFilterBarItems([{ fieldId: 'tags', value: ['a', 'b'] }])).toEqual([
      { id: 'tags', fieldId: 'tags', operatorId: 'in', value: ['a', 'b'] },
    ]);
  });

  it('keeps empty values as pending chips and maps the legacy Any sentinel to empty', () => {
    expect(
      traceTokensToFilterBarItems([
        { fieldId: 'traceId', value: '' },
        { fieldId: 'status', value: 'Any' },
        { fieldId: 'tags', value: [] },
      ]),
    ).toEqual([
      { id: 'traceId', fieldId: 'traceId', operatorId: 'is', value: '' },
      { id: 'status', fieldId: 'status', operatorId: 'is', value: '' },
      { id: 'tags', fieldId: 'tags', operatorId: 'in', value: [] },
    ]);
  });
});

describe('filterBarItemsToTraceTokens', () => {
  it('round-trips items back to tokens', () => {
    const tokens = [
      { fieldId: 'status', value: 'error' },
      { fieldId: 'tags', value: ['a'] },
      { fieldId: 'traceId', value: 'abc' },
    ];
    expect(filterBarItemsToTraceTokens(traceTokensToFilterBarItems(tokens))).toEqual(tokens);
  });

  it('coerces non-string values to strings', () => {
    expect(
      filterBarItemsToTraceTokens([
        { id: 'a', fieldId: 'traceId', operatorId: 'is', value: 42 },
        { id: 'b', fieldId: 'tags', operatorId: 'in', value: [1, true] },
      ]),
    ).toEqual([
      { fieldId: 'traceId', value: '42' },
      { fieldId: 'tags', value: ['1', 'true'] },
    ]);
  });
});
