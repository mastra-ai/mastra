import { describe, expect, it } from 'vitest';
import type { TracesFilters } from './components/traces-explorer/traces-explorer-actions';
import { DEFAULT_TRACE_COLUMN_PREFERENCES } from './trace-list-columns';
import {
  appliedTraceSavedViewState,
  toTraceSavedViewState,
  traceFiltersFromSavedView,
  traceSavedViewStateSchema,
  tracesPageStateFromView,
} from './trace-saved-views';
import type { TraceSavedViewState, TracesPageState } from './trace-saved-views';

const DEFAULT_PRESET = 'last-7d';

const DEFAULT_COLUMNS = { preferences: DEFAULT_TRACE_COLUMN_PREFERENCES, order: [] };

const page = (filters: Partial<TracesFilters> = {}, overrides: Partial<TracesPageState> = {}): TracesPageState => ({
  filters: { datePreset: 'last-24h', tokens: [], groups: [], ...filters },
  sortDirection: 'desc',
  columns: DEFAULT_COLUMNS,
  ...overrides,
});

const savedFilter = (
  nodes: TraceSavedViewState['filter']['nodes'],
  preset = 'last-24h',
): Pick<TraceSavedViewState, 'timeRange' | 'filter'> => ({
  timeRange: { preset },
  filter: { logic: 'and', nodes },
});

describe('toTraceSavedViewState', () => {
  it('saves filters without their UI ids and with explicit operators', () => {
    const state = toTraceSavedViewState(
      page({
        tokens: [
          { fieldId: 'status', value: 'error' },
          { fieldId: 'tags', value: ['a', 'b'] },
        ],
        groups: [
          {
            id: 'g1',
            logic: 'or',
            nodes: [
              { id: 'n1', fieldId: 'environment', value: 'production' },
              { id: 'n2', fieldId: 'environment', value: 'staging', operatorId: 'isNot' },
            ],
          },
        ],
      }),
    );

    expect(state.timeRange).toEqual({ preset: 'last-24h' });
    expect(state.filter).toEqual({
      logic: 'and',
      nodes: [
        { fieldId: 'status', operatorId: 'is', value: 'error' },
        { fieldId: 'tags', operatorId: 'in', value: ['a', 'b'] },
        {
          kind: 'group',
          logic: 'or',
          nodes: [
            { fieldId: 'environment', operatorId: 'is', value: 'production' },
            { fieldId: 'environment', operatorId: 'isNot', value: 'staging' },
          ],
        },
      ],
    });
  });

  it('leaves out chips whose value has not been picked yet, but keeps presence filters', () => {
    const state = toTraceSavedViewState(
      page({
        tokens: [
          { fieldId: 'status', value: '' },
          { fieldId: 'tags', value: [] },
          { fieldId: 'threadId', value: '', operatorId: 'exists' },
        ],
        groups: [{ id: 'g1', logic: 'and', nodes: [{ id: 'n1', fieldId: 'environment', value: '' }] }],
      }),
    );

    expect(state.filter.nodes).toEqual([{ fieldId: 'threadId', operatorId: 'exists', value: '' }]);
  });

  it('saves a custom range with its dates', () => {
    const state = toTraceSavedViewState(
      page({
        datePreset: 'custom',
        dateFrom: new Date('2026-10-01T00:00:00.000Z'),
        dateTo: new Date('2026-10-02T00:00:00.000Z'),
      }),
    );

    expect(state.timeRange).toEqual({
      preset: 'custom',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
    });
  });

  it('saves the sort, the columns in display order and the column order the table shows', () => {
    const state = toTraceSavedViewState(
      page(
        {},
        {
          sortDirection: 'asc',
          columns: {
            preferences: { visibleColumns: ['duration', 'type'], customColumns: ['traceId'], metadataKeys: ['tier'] },
            order: ['metadata:tier', 'startTime', 'gone'],
          },
        },
      ),
    );

    expect(state.sort).toEqual({ field: 'startedAt', direction: 'asc' });
    expect(state.columns).toEqual({
      visibleColumns: ['type', 'duration'],
      customColumns: ['traceId'],
      metadataKeys: ['tier'],
    });
    // Resolved like the table does: unknown keys are skipped, unplaced columns go to their default index.
    expect(state.columnOrder).toEqual([
      'metadata:tier',
      'type',
      'name',
      'status',
      'duration',
      'custom:traceId',
      'startTime',
    ]);
  });
});

describe('traceFiltersFromSavedView', () => {
  it('reopens filters as tokens and groups the explorer can show', () => {
    const { filters, unreadableCount } = traceFiltersFromSavedView(
      savedFilter([
        { fieldId: 'status', operatorId: 'is', value: 'error' },
        { fieldId: 'tags', operatorId: 'notIn', value: ['a'] },
        { kind: 'group', logic: 'or', nodes: [{ fieldId: 'environment', operatorId: 'is', value: 'production' }] },
      ]),
      DEFAULT_PRESET,
    );

    expect(unreadableCount).toBe(0);
    expect(filters).toEqual({
      datePreset: 'last-24h',
      tokens: [
        { fieldId: 'status', value: 'error' },
        { fieldId: 'tags', value: ['a'], operatorId: 'notIn' },
      ],
      groups: [
        {
          id: 'saved-view-group-2',
          logic: 'or',
          nodes: [{ id: 'saved-view-group-2-0', fieldId: 'environment', value: 'production' }],
        },
      ],
    });
  });

  it("keeps filters some servers can't run, for the explorer to show muted", () => {
    const { filters, unreadableCount } = traceFiltersFromSavedView(
      savedFilter([
        { fieldId: 'durationMs', operatorId: 'gt', value: '100' },
        { kind: 'group', logic: 'or', nodes: [{ fieldId: 'environment', operatorId: 'is', value: 'production' }] },
      ]),
      DEFAULT_PRESET,
    );

    expect(filters.tokens).toEqual([{ fieldId: 'durationMs', value: '100', operatorId: 'gt' }]);
    expect(filters.groups).toHaveLength(1);
    expect(unreadableCount).toBe(0);
  });

  it('leaves out and counts filters whose operator this Studio does not know, in groups too', () => {
    const { filters, unreadableCount } = traceFiltersFromSavedView(
      savedFilter([
        { fieldId: 'status', operatorId: 'is', value: 'success' },
        { fieldId: 'status', operatorId: 'nonsense', value: 'x' },
        {
          kind: 'group',
          logic: 'or',
          nodes: [
            { fieldId: 'environment', operatorId: 'is', value: 'production' },
            { fieldId: 'environment', operatorId: 'resembles', value: 'prod' },
          ],
        },
      ]),
      DEFAULT_PRESET,
    );

    expect(filters.tokens).toEqual([{ fieldId: 'status', value: 'success' }]);
    expect(filters.groups[0]?.nodes).toHaveLength(1);
    expect(unreadableCount).toBe(2);
  });

  it('falls back to the default time range for a preset this Studio does not know', () => {
    expect(traceFiltersFromSavedView(savedFilter([], 'last-90d'), DEFAULT_PRESET).filters.datePreset).toBe('last-7d');
  });

  it('restores a custom range', () => {
    const { filters } = traceFiltersFromSavedView(
      {
        timeRange: { preset: 'custom', from: '2026-10-01T00:00:00.000Z', to: 'not a date' },
        filter: { logic: 'and', nodes: [] },
      },
      DEFAULT_PRESET,
    );

    expect(filters.datePreset).toBe('custom');
    expect(filters.dateFrom).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(filters.dateTo).toBeUndefined();
  });
});

describe('traceSavedViewStateSchema', () => {
  const valid = {
    version: 1,
    ...savedFilter([
      {
        kind: 'group',
        logic: 'and',
        nodes: [{ kind: 'group', logic: 'or', nodes: [{ fieldId: 'status', operatorId: 'is', value: 'error' }] }],
      },
    ]),
    sort: { field: 'startedAt', direction: 'desc' },
    columns: { visibleColumns: ['type'], customColumns: [], metadataKeys: [] },
    columnOrder: [],
  };

  it('accepts nested groups', () => {
    expect(traceSavedViewStateSchema.safeParse(valid).success).toBe(true);
  });

  it('keeps a view whose columns include some this Studio does not know', () => {
    const parsed = traceSavedViewStateSchema.safeParse({
      ...valid,
      columns: { visibleColumns: ['type', 'sparkline'], customColumns: ['nope'], metadataKeys: [' tier '] },
    });

    expect(parsed.success && parsed.data.columns).toEqual({
      visibleColumns: ['type'],
      customColumns: [],
      metadataKeys: ['tier'],
    });
  });

  it('rejects a future version', () => {
    expect(traceSavedViewStateSchema.safeParse({ ...valid, version: 2 }).success).toBe(false);
  });
});

describe('appliedTraceSavedViewState', () => {
  it('matches what the page shows once the view is applied', () => {
    const saved = toTraceSavedViewState(
      page({ tokens: [{ fieldId: 'status', value: 'error' }] }, { sortDirection: 'asc' }),
    );

    expect(appliedTraceSavedViewState(saved, DEFAULT_PRESET)).toEqual(saved);
    expect(toTraceSavedViewState(tracesPageStateFromView(saved, DEFAULT_PRESET))).toEqual(saved);
  });
});
