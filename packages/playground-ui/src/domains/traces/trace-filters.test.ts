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

  describe('when a field can be unset', () => {
    it('keeps exists and does not exist', () => {
      const full = ['is', 'isNot', 'in', 'notIn', 'exists', 'notExists'];
      expect(byId('environment')?.operators).toEqual(full);
      expect(byId('threadId')?.operators).toEqual(full);
      expect(byId('spans.model')?.operators).toEqual(full);
    });
  });

  describe('when a field is always present', () => {
    it('omits exists and does not exist', () => {
      expect(byId('traceId')?.operators).toEqual(['is', 'isNot', 'in', 'notIn']);
      expect(byId('entityName')?.operators).toEqual(['is', 'isNot', 'in', 'notIn']);
      expect(byId('status')?.operators).not.toContain('exists');
      expect(byId('rootEntityType')?.operators).not.toContain('exists');
    });
  });

  it('keeps synthetic fields on is and in only', () => {
    expect(byId('status')?.operators).toEqual(['is', 'in']);
    expect(byId('rootEntityType')?.operators).toEqual(['is', 'in']);
  });

  it('offers comparison operators on numeric fields', () => {
    expect(byId('spans.durationMs')?.type).toBe('number');
    expect(byId('spans.durationMs')?.operators).toEqual([
      'is',
      'isNot',
      'gt',
      'gte',
      'lt',
      'lte',
      'exists',
      'notExists',
    ]);
    expect(byId('scores.score')?.type).toBe('number');
    expect(byId('feedback.value')?.type).toBe('number');
  });

  it('offers only presence operators on presence fields', () => {
    expect(byId('spans.error')?.operators).toEqual(['exists', 'notExists']);
    expect(byId('feedback.comment')?.operators).toEqual(['exists', 'notExists']);
  });

  it('lists picker fields, then free-text, then span, score and feedback fields, alphabetically', () => {
    expect(fields.map(f => f.id)).toEqual([
      'environment',
      'entityName',
      'rootEntityType',
      'status',
      'entityId',
      'resourceId',
      'threadId',
      'traceId',
      'spans.model',
      'spans.provider',
      'spans.durationMs',
      'spans.error',
      'spans.name',
      'spans.spanType',
      'scores.score',
      'scores.scorerId',
      'feedback.comment',
      'feedback.feedbackType',
      'feedback.value',
    ]);
  });

  describe('when a value suggestions resolver factory is provided', () => {
    const resolver = async () => [{ value: 'gpt-4o' }];
    const calls: [string, string][] = [];
    const withSuggestions = createTraceFilterBarFields({
      availableRootEntityNames: [],
      availableEnvironments: [],
      valueSuggestions: (scope, path) => {
        calls.push([scope, path]);
        return resolver;
      },
    });

    it('wires strict lazy suggestions for related pick fields', () => {
      const model = withSuggestions.find(f => f.id === 'spans.model');
      expect(model?.suggestions).toBe(resolver);
      expect(model?.strict).toBe(true);
      expect(calls).toContainEqual(['spans', 'model']);
      expect(calls).toContainEqual(['scores', 'scorerId']);
      expect(calls).toContainEqual(['feedback', 'feedbackType']);
    });
  });

  describe('when no value suggestions resolver factory is provided', () => {
    it('keeps related pick fields free-text', () => {
      expect(byId('spans.model')?.suggestions).toBeUndefined();
      expect(byId('spans.model')?.strict).toBeUndefined();
    });
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
      expect(region?.operators).toEqual(['is', 'isNot', 'in', 'notIn', 'exists', 'notExists']);
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

describe('filter operator URL params', () => {
  describe('when the URL carries a .op param next to a value param', () => {
    it('reads the operator onto the token', () => {
      expect(getTracePropertyFilterTokens(new URLSearchParams('filterTraceId=abc&filterTraceId.op=isNot'))).toEqual([
        { fieldId: 'traceId', value: 'abc', operatorId: 'isNot' },
      ]);
    });

    it('reads repeated values as a many-valued token', () => {
      expect(
        getTracePropertyFilterTokens(
          new URLSearchParams('filterMetadata.region=eu&filterMetadata.region=us&filterMetadata.region.op=notIn'),
        ),
      ).toEqual([{ fieldId: 'metadata.region', value: ['eu', 'us'], operatorId: 'notIn' }]);
    });

    it('still emits a token for a presence operator with an empty value', () => {
      expect(getTracePropertyFilterTokens(new URLSearchParams('filterSpanError=&filterSpanError.op=exists'))).toEqual([
        { fieldId: 'spans.error', value: '', operatorId: 'exists' },
      ]);
    });
  });

  describe('when the .op param is not a known operator', () => {
    it('falls back to is', () => {
      expect(getTracePropertyFilterTokens(new URLSearchParams('filterTraceId=abc&filterTraceId.op=like'))).toEqual([
        { fieldId: 'traceId', value: 'abc' },
      ]);
    });
  });

  describe('when the .op param appears without its value param', () => {
    it('emits no token', () => {
      expect(getTracePropertyFilterTokens(new URLSearchParams('filterTraceId.op=isNot'))).toEqual([]);
    });
  });

  describe('when tokens are written back to the URL', () => {
    it('writes .op only for non-default operators and drops stale ones', () => {
      const params = new URLSearchParams('filterThreadId=t&filterThreadId.op=isNot');

      applyTracePropertyFilterTokens(params, [
        { fieldId: 'traceId', value: 'abc', operatorId: 'isNot' },
        { fieldId: 'threadId', value: 't' },
        { fieldId: 'spans.durationMs', value: '1000', operatorId: 'gt' },
      ]);

      expect(params.toString()).toBe(
        'filterTraceId=abc&filterTraceId.op=isNot&filterThreadId=t&filterSpanDurationMs=1000&filterSpanDurationMs.op=gt',
      );
    });

    it('round-trips a many-valued notIn token', () => {
      const params = new URLSearchParams();
      const tokens = [{ fieldId: 'metadata.region', value: ['eu', 'us'], operatorId: 'notIn' as const }];

      applyTracePropertyFilterTokens(params, tokens);

      expect(getTracePropertyFilterTokens(params)).toEqual(tokens);
    });

    it('writes an empty value param for a presence token', () => {
      const params = new URLSearchParams();

      applyTracePropertyFilterTokens(params, [{ fieldId: 'spans.error', value: '', operatorId: 'exists' }]);

      expect(params.toString()).toBe('filterSpanError=&filterSpanError.op=exists');
    });
  });

  describe('when filters are preserved for storage', () => {
    it('carries .op params along with their value', () => {
      const preserved = getPreservedTraceFilterParams(
        new URLSearchParams('filterTraceId=abc&filterTraceId.op=isNot&filterThreadId.op=isNot'),
      );

      expect(preserved.toString()).toBe('filterTraceId=abc&filterTraceId.op=isNot');
    });

    it('keeps a presence-only filter', () => {
      const params = new URLSearchParams('filterSpanError=&filterSpanError.op=exists');

      expect(getPreservedTraceFilterParams(params).toString()).toBe('filterSpanError=&filterSpanError.op=exists');
      expect(hasAnyTraceFilterParams(params)).toBe(true);
    });
  });
});

describe('traceTokensToFilterBarItems', () => {
  describe('when a token carries an operator', () => {
    it('round-trips it through the filter bar item', () => {
      const tokens = [
        { fieldId: 'traceId', value: 'abc', operatorId: 'isNot' as const },
        { fieldId: 'spans.durationMs', value: '10', operatorId: 'gt' as const },
      ];
      const items = traceTokensToFilterBarItems(tokens);
      expect(items.map(i => i.operatorId)).toEqual(['isNot', 'gt']);
      expect(filterBarItemsToTraceTokens(items)).toEqual(tokens);
    });
  });

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
