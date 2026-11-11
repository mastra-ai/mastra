import { describe, expect, it } from 'vitest';
import { SAVED_VIEW_STATE_MAX_BYTES, savedViewStateEnvelopeSchema, savedViewStateSchema } from './saved-view';
import type { SavedViewState } from './saved-view';

const tracesView: SavedViewState = {
  schemaVersion: 1,
  page: 'traces',
  filters: [
    { fieldId: 'status', value: 'error' },
    { fieldId: 'tags', value: ['prod', 'beta'], operatorId: 'notIn' },
    { fieldId: 'metadata.region', value: '', operatorId: 'exists' },
    {
      id: 'g1',
      logic: 'or',
      nodes: [
        { id: 't1', fieldId: 'entityName', value: 'support' },
        { id: 'g2', logic: 'and', nodes: [{ id: 't2', fieldId: 'durationMs', value: '500', operatorId: 'gt' }] },
      ],
    },
  ],
  dateRange: { preset: 'last-7d' },
  sort: { field: 'startedAt', direction: 'asc' },
  columns: [
    { id: 'input', visible: true },
    { id: 'metadata.region', visible: true },
    { id: 'output', visible: false },
  ],
  options: { listMode: 'branches' },
};

/** A view whose JSON is exactly `bytes` long, padded through a filter value. */
function viewOfSize(bytes: number): Record<string, unknown> {
  const base = { schemaVersion: 1, page: 'logs', filters: [{ fieldId: 'message', value: '' }] };
  const padding = bytes - new TextEncoder().encode(JSON.stringify(base)).length;
  return { ...base, filters: [{ fieldId: 'message', value: 'x'.repeat(padding) }] };
}

describe('savedViewStateSchema', () => {
  it.each(['traces', 'spans', 'threads', 'logs'] as const)('accepts a %s view', page => {
    expect(savedViewStateSchema.parse({ ...tracesView, page })).toEqual({ ...tracesView, page });
  });

  it('accepts a minimal view', () => {
    expect(savedViewStateSchema.safeParse({ schemaVersion: 1, page: 'logs', filters: [] }).success).toBe(true);
  });

  it('accepts an open-ended custom range', () => {
    const view = { ...tracesView, dateRange: { from: '2026-10-01T00:00:00.000Z' } };
    expect(savedViewStateSchema.safeParse(view).success).toBe(true);
  });

  it('accepts a custom range with an offset', () => {
    const view = { ...tracesView, dateRange: { from: '2026-10-01T00:00:00+02:00', to: '2026-10-02T00:00:00Z' } };
    expect(savedViewStateSchema.safeParse(view).success).toBe(true);
  });

  it.each([
    ['an unknown schema version', { schemaVersion: 2 }],
    ['an unknown page', { page: 'metrics' }],
    ['missing filters', { filters: undefined }],
    ['a token without a field', { filters: [{ fieldId: '', value: 'x' }] }],
    ['a token with a numeric value', { filters: [{ fieldId: 'status', value: 1 }] }],
    ['an empty operator', { filters: [{ fieldId: 'status', value: 'error', operatorId: '' }] }],
    ['a group with an unknown logic', { filters: [{ id: 'g', logic: 'xor', nodes: [] }] }],
    ['a group without an id', { filters: [{ id: '', logic: 'and', nodes: [] }] }],
    [
      'an invalid node deep in a group',
      { filters: [{ id: 'g', logic: 'and', nodes: [{ id: 'h', logic: 'or', nodes: [{ fieldId: 'x', value: 2 }] }] }] },
    ],
    ['an empty preset', { dateRange: { preset: '' } }],
    ['a range mixing preset and dates', { dateRange: { preset: 'custom', from: '2026-10-01T00:00:00Z' } }],
    ['a range that is not a datetime', { dateRange: { from: 'yesterday' } }],
    ['a range ending before it starts', { dateRange: { from: '2026-10-02T00:00:00Z', to: '2026-10-01T00:00:00Z' } }],
    ['an unknown sort direction', { sort: { field: 'startedAt', direction: 'up' } }],
    ['an empty sort field', { sort: { field: '', direction: 'asc' } }],
    [
      'duplicate column ids',
      {
        columns: [
          { id: 'input', visible: true },
          { id: 'input', visible: false },
        ],
      },
    ],
    ['a column without visibility', { columns: [{ id: 'input' }] }],
  ])('rejects %s', (_, patch) => {
    expect(savedViewStateSchema.safeParse({ ...tracesView, ...patch }).success).toBe(false);
  });

  it('accepts a view of exactly the size limit', () => {
    expect(savedViewStateSchema.safeParse(viewOfSize(SAVED_VIEW_STATE_MAX_BYTES)).success).toBe(true);
  });

  it('rejects a view one byte over the size limit', () => {
    expect(savedViewStateSchema.safeParse(viewOfSize(SAVED_VIEW_STATE_MAX_BYTES + 1)).success).toBe(false);
  });

  it('counts multi-byte characters by their UTF-8 size', () => {
    const view = viewOfSize(SAVED_VIEW_STATE_MAX_BYTES);
    // 'é' is two bytes in UTF-8, so swapping one 'x' for it goes one byte over.
    const [token] = view.filters as { fieldId: string; value: string }[];
    const overByOne = { ...view, filters: [{ ...token, value: 'é' + token!.value.slice(1) }] };
    expect(savedViewStateSchema.safeParse(overByOne).success).toBe(false);
  });
});

describe('savedViewStateEnvelopeSchema', () => {
  it('accepts a full view', () => {
    expect(savedViewStateEnvelopeSchema.parse(tracesView)).toEqual(tracesView);
  });

  it('accepts internals it does not know', () => {
    const view = { schemaVersion: 1, page: 'spans', filters: 'anything', layout: { dense: true } };
    expect(savedViewStateEnvelopeSchema.parse(view)).toEqual(view);
  });

  it.each([
    ['an unknown schema version', { schemaVersion: 2, page: 'traces' }],
    ['a missing schema version', { page: 'traces' }],
    ['an unknown page', { schemaVersion: 1, page: 'metrics' }],
    ['a missing page', { schemaVersion: 1 }],
  ])('rejects %s', (_, view) => {
    expect(savedViewStateEnvelopeSchema.safeParse(view).success).toBe(false);
  });

  it('accepts state of exactly the size limit', () => {
    expect(savedViewStateEnvelopeSchema.safeParse(viewOfSize(SAVED_VIEW_STATE_MAX_BYTES)).success).toBe(true);
  });

  it('rejects state one byte over the size limit', () => {
    expect(savedViewStateEnvelopeSchema.safeParse(viewOfSize(SAVED_VIEW_STATE_MAX_BYTES + 1)).success).toBe(false);
  });
});
