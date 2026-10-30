import { savedViewStateSchema } from '@mastra/core/storage';
import type { FilterNode, SavedViewState } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  writeObservabilityListDates,
  writeObservabilityListFilters,
  writeObservabilityListSort,
} from './observability-list-url-state';
import { applySavedView, savedViewFromSearchParams } from './saved-view-state';
import {
  LOGS_DATE_FROM_PARAM,
  LOGS_DATE_PRESET_PARAM,
  applyLogsPropertyFilterTokens,
} from '@/domains/logs/log-filters';
import {
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_TO_PARAM,
  TRACE_LIST_MODE_PARAM,
  applyTracePropertyFilterTokens,
} from '@/domains/traces/trace-filters';
import { DEFAULT_TRACE_COLUMN_PREFERENCES } from '@/domains/traces/trace-list-columns';
import type { TraceColumnPreferences } from '@/domains/traces/trace-list-columns';
import type { TraceFilterGroup, TraceFilterToken } from '@/domains/traces/trace-query-filters';
import { SORT_DIR_PARAM, SORT_KEY_PARAM } from '@/lib/sort/use-url-sort';

const FROM = '2026-10-01T00:00:00.000Z';
const TO = '2026-10-02T12:30:00.000Z';

const sorted = (params: URLSearchParams) => {
  const copy = new URLSearchParams(params);
  copy.sort();
  return copy.toString();
};

const traceTokens: TraceFilterToken[] = [
  { fieldId: 'status', value: 'error' },
  { fieldId: 'entityName', value: ['Weather Agent', 'Support Agent'], operatorId: 'in' },
  { fieldId: 'tags', value: ['prod'] },
  { fieldId: 'metadata.region', value: 'eu', operatorId: 'isNot' },
  { fieldId: 'spans.durationMs', value: '500', operatorId: 'gt' },
  { fieldId: 'threadId', value: '' },
];
const traceGroups: TraceFilterGroup[] = [
  {
    id: 'g1',
    logic: 'or',
    nodes: [
      { id: 't1', fieldId: 'environment', value: 'production' },
      {
        id: 'g2',
        logic: 'and',
        nodes: [{ id: 't2', fieldId: 'spans.name', value: 'weather', operatorId: 'matches' }],
      },
    ],
  },
];

// The by-hand URLs set filters, then the range, then the sort: the order applying a view writes them in.

/** The traces URL as the page writes it when the user sets these by hand. */
function tracesUrlByHand() {
  const params = new URLSearchParams('traceId=trace-1');
  applyTracePropertyFilterTokens(params, traceTokens, traceGroups);
  params.set(TRACE_DATE_PRESET_PARAM, 'custom');
  params.set(TRACE_DATE_FROM_PARAM, FROM);
  params.set(TRACE_DATE_TO_PARAM, TO);
  params.set(SORT_KEY_PARAM, 'timeToFirstChunkMs');
  params.set(SORT_DIR_PARAM, 'asc');
  params.set(TRACE_LIST_MODE_PARAM, 'branches');
  return params;
}

const traceColumns: TraceColumnPreferences = {
  visibleColumns: ['type', 'input', 'duration', 'inputTokens'],
  customColumns: ['threadId'],
  metadataKeys: ['region'],
};

const tracesView: SavedViewState = {
  schemaVersion: 1,
  page: 'traces',
  filters: [
    { fieldId: 'status', value: 'error' },
    { fieldId: 'entityName', value: ['Weather Agent', 'Support Agent'], operatorId: 'in' },
    { fieldId: 'tags', value: ['prod'] },
    { fieldId: 'metadata.region', value: 'eu', operatorId: 'isNot' },
    { fieldId: 'spans.durationMs', value: '500', operatorId: 'gt' },
    { fieldId: 'threadId', value: '' },
    ...traceGroups,
  ],
  dateRange: { from: FROM, to: TO },
  sort: { field: 'timeToFirstChunkMs', direction: 'asc' },
  columns: [
    { id: 'type', visible: true },
    { id: 'input', visible: true },
    { id: 'output', visible: false },
    { id: 'duration', visible: true },
    { id: 'timeToFirstChunk', visible: false },
    { id: 'timeToFirstToken', visible: false },
    { id: 'endTime', visible: false },
    { id: 'environment', visible: false },
    { id: 'inputTokens', visible: true },
    { id: 'outputTokens', visible: false },
    { id: 'totalTokens', visible: false },
    { id: 'estimatedCost', visible: false },
    { id: 'custom.threadId', visible: true },
    { id: 'custom.traceId', visible: false },
    { id: 'custom.resourceId', visible: false },
    { id: 'custom.entityId', visible: false },
    { id: 'metadata.region', visible: true },
  ],
  options: { listMode: 'branches' },
};

const listTokens: TraceFilterToken[] = [
  { fieldId: 'spanType', value: 'tool_call' },
  { fieldId: 'entityName', value: ['Weather Agent'], operatorId: 'in' },
  { fieldId: 'durationMs', value: '100', operatorId: 'gte' },
  { fieldId: 'environment', value: '', operatorId: 'exists' },
];
const listGroups: TraceFilterGroup[] = [
  { id: 'g1', logic: 'or', nodes: [{ id: 't1', fieldId: 'status', value: 'error' }] },
];

/** The spans / threads URL as the page writes it when the user sets these by hand. */
function listUrlByHand(tokens: TraceFilterToken[], groups: TraceFilterGroup[]) {
  const params = new URLSearchParams('spanId=span-1');
  writeObservabilityListFilters(params, { tokens, groups });
  writeObservabilityListDates(params, { datePreset: 'last-24h' });
  writeObservabilityListSort(params, { field: 'startedAt', direction: 'asc' });
  return params;
}

const spansView: SavedViewState = {
  schemaVersion: 1,
  page: 'spans',
  filters: [...listTokens, ...listGroups],
  dateRange: { preset: 'last-24h' },
  sort: { field: 'startedAt', direction: 'asc' },
};

const threadTokens: TraceFilterToken[] = [
  { fieldId: 'traceCount', value: '3', operatorId: 'gt' },
  { fieldId: 'resourceId', value: 'user-1' },
];
const threadsView: SavedViewState = {
  schemaVersion: 1,
  page: 'threads',
  filters: [...threadTokens, ...listGroups],
  dateRange: { preset: 'last-24h' },
  sort: { field: 'startedAt', direction: 'asc' },
};

/** The logs URL as the page writes it when the user sets these by hand. */
function logsUrlByHand() {
  const params = new URLSearchParams('logId=log-1');
  applyLogsPropertyFilterTokens(params, [
    { fieldId: 'rootEntityType', value: 'agent' },
    { fieldId: 'level', value: 'error' },
    { fieldId: 'tags', value: [] },
  ]);
  params.set(LOGS_DATE_PRESET_PARAM, 'custom');
  params.set(LOGS_DATE_FROM_PARAM, FROM);
  params.set(SORT_KEY_PARAM, 'timestamp');
  params.set(SORT_DIR_PARAM, 'asc');
  return params;
}

const logsView: SavedViewState = {
  schemaVersion: 1,
  page: 'logs',
  filters: [
    { fieldId: 'rootEntityType', value: 'agent' },
    { fieldId: 'level', value: 'error' },
    { fieldId: 'tags', value: [] },
  ],
  dateRange: { from: FROM },
  sort: { field: 'timestamp', direction: 'asc' },
};

const pages = [
  {
    page: 'traces',
    url: tracesUrlByHand,
    base: 'traceId=trace-1',
    view: tracesView,
    columns: traceColumns,
  },
  { page: 'spans', url: () => listUrlByHand(listTokens, listGroups), base: 'spanId=span-1', view: spansView },
  { page: 'threads', url: () => listUrlByHand(threadTokens, listGroups), base: 'spanId=span-1', view: threadsView },
  { page: 'logs', url: logsUrlByHand, base: 'logId=log-1', view: logsView },
] as const;

describe.each(pages)('saved views on the $page page', ({ page, url, base, view, ...rest }) => {
  const columns = 'columns' in rest ? rest.columns : undefined;

  it('applying the view gives the URL the user gets by setting it by hand', () => {
    expect(applySavedView(view, new URLSearchParams(base)).params.toString()).toBe(url().toString());
  });

  it('saving the hand-set URL gives the view', () => {
    expect(savedViewFromSearchParams(page, url(), { columns })).toEqual(view);
  });

  it('a saved URL applies back to the same URL', () => {
    const saved = savedViewFromSearchParams(page, url(), { columns });
    expect(applySavedView(saved, new URLSearchParams(base)).params.toString()).toBe(url().toString());
  });

  it('a saved view passes the saved view schema', () => {
    expect(savedViewStateSchema.safeParse(savedViewFromSearchParams(page, url(), { columns })).success).toBe(true);
  });

  it("replaces the page's current view params, keeps the others and goes back to the first page", () => {
    const current = new URLSearchParams(base);
    current.set(TRACE_DATE_PRESET_PARAM, 'last-30d');
    current.set(SORT_KEY_PARAM, 'nope');
    current.set('page', '4');
    const empty: SavedViewState = { schemaVersion: 1, page, filters: [] };

    expect(applySavedView(empty, current).params.toString()).toBe(base);
    expect(sorted(applySavedView(view, current).params)).toBe(sorted(url()));
  });
});

describe('saved view columns', () => {
  it('apply as the column preferences they were saved from', () => {
    const saved = savedViewFromSearchParams('traces', new URLSearchParams(), { columns: traceColumns });
    expect(applySavedView(saved, new URLSearchParams()).columns).toEqual(traceColumns);
  });

  it('give the default preferences back', () => {
    const saved = savedViewFromSearchParams('traces', new URLSearchParams(), {
      columns: DEFAULT_TRACE_COLUMN_PREFERENCES,
    });
    expect(applySavedView(saved, new URLSearchParams()).columns).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
  });

  it('apply on the threads page as the thread columns they were saved from', () => {
    const threadColumns: TraceColumnPreferences = {
      visibleColumns: ['input', 'traceCount', 'timeToFirstChunk', 'timeToFirstToken'],
      customColumns: [],
      metadataKeys: [],
    };
    const saved = savedViewFromSearchParams('threads', new URLSearchParams(), { columns: threadColumns });
    expect(applySavedView(saved, new URLSearchParams()).columns).toEqual(threadColumns);
  });

  it('are not saved or applied on pages with fixed columns', () => {
    const saved = savedViewFromSearchParams('logs', new URLSearchParams(), { columns: traceColumns });
    expect(saved.columns).toBeUndefined();
    expect(applySavedView({ ...saved, columns: tracesView.columns }, new URLSearchParams()).columns).toBeUndefined();
  });

  it('leave no column preferences to apply when the view has none', () => {
    expect(applySavedView(spansView, new URLSearchParams()).columns).toBeUndefined();
  });
});

describe('a view with parts the page no longer supports', () => {
  const applied = (view: SavedViewState) => applySavedView(view, new URLSearchParams()).params;
  const tracesWith = (change: Partial<SavedViewState>): SavedViewState => ({ ...tracesView, ...change });

  it('drops a filter on a field the page does not know, and applies the rest', () => {
    const view = tracesWith({ filters: [...tracesView.filters, { fieldId: 'removedField', value: 'x' }] });
    expect(applied(view).toString()).toBe(applied(tracesView).toString());
  });

  it('drops a filter whose operator the field does not allow, and applies the rest', () => {
    const view = tracesWith({
      filters: [...tracesView.filters, { fieldId: 'status', value: 'error', operatorId: 'gt' }],
    });
    expect(applied(view).toString()).toBe(applied(tracesView).toString());
  });

  // The shared filter schema accepts any operator id, e.g. one a dashboard or a newer page added.
  it.each([
    // Known to the traces URL but not offered by its filter bar, so no per-field operator list.
    ['traces', 'runId'],
    ['spans', 'name'],
    ['threads', 'resourceId'],
    ['logs', 'resourceId'],
  ] as const)(
    'drops a %s filter with an operator the filter bar does not know, and applies the rest',
    (page, fieldId) => {
      const kept = { fieldId, value: 'a' };
      const unknown = { fieldId, value: 'b', operatorId: 'startsWith' };
      const base: SavedViewState = { schemaVersion: 1, page, filters: [kept] };
      const view: SavedViewState = { ...base, filters: [kept, unknown] };
      expect(applied(view).toString()).toBe(applied(base).toString());
      expect(savedViewFromSearchParams(page, applied(view)).filters).toEqual([kept]);
    },
  );

  it('drops a filter with an unknown operator inside a group and keeps the rest of the group', () => {
    const group = (nodes: FilterNode[]): SavedViewState => tracesWith({ filters: [{ id: 'g1', logic: 'or', nodes }] });
    const kept = { id: 't1', fieldId: 'environment', value: 'production' };
    const view = group([kept, { id: 't2', fieldId: 'runId', value: 'run-1', operatorId: 'startsWith' }]);
    expect(applied(view).toString()).toBe(applied(group([kept])).toString());
  });

  it('drops an unknown filter inside a group and keeps the group', () => {
    const view = tracesWith({
      filters: [
        {
          id: 'g1',
          logic: 'or',
          nodes: [
            { id: 't1', fieldId: 'environment', value: 'production' },
            { id: 't2', fieldId: 'removedField', value: 'x' },
          ],
        },
      ],
    });
    const expected = tracesWith({
      filters: [{ id: 'g1', logic: 'or', nodes: [{ id: 't1', fieldId: 'environment', value: 'production' }] }],
    });
    expect(applied(view).toString()).toBe(applied(expected).toString());
  });

  it('drops a group left with no filters, and a group nested in it', () => {
    const view = tracesWith({
      filters: [
        { fieldId: 'status', value: 'error' },
        {
          id: 'g1',
          logic: 'or',
          nodes: [{ id: 'g2', logic: 'and', nodes: [{ id: 't1', fieldId: 'removedField', value: 'x' }] }],
        },
      ],
    });
    expect(savedViewFromSearchParams('traces', applied(view)).filters).toEqual([{ fieldId: 'status', value: 'error' }]);
  });

  it('drops groups on the logs page, which has none', () => {
    const view: SavedViewState = { ...logsView, filters: [...logsView.filters, ...listGroups] };
    expect(applied(view).toString()).toBe(applied(logsView).toString());
  });

  it('drops a logs filter with an operator the logs URL cannot hold', () => {
    const view: SavedViewState = {
      ...logsView,
      filters: [...logsView.filters, { fieldId: 'traceId', value: 't-1', operatorId: 'isNot' }],
    };
    expect(applied(view).toString()).toBe(applied(logsView).toString());
  });

  it('drops a sort on a field the page cannot sort by, so the page sorts by its default', () => {
    const params = applied(tracesWith({ sort: { field: 'removedField', direction: 'asc' } }));
    expect(params.has(SORT_KEY_PARAM)).toBe(false);
    expect(params.has(SORT_DIR_PARAM)).toBe(false);
    expect(params.get(TRACE_LIST_MODE_PARAM)).toBe('branches');
  });

  it('drops a date preset the page does not know, so the page shows its default range', () => {
    const params = applied(tracesWith({ dateRange: { preset: 'last-90d' } }));
    expect(params.has(TRACE_DATE_PRESET_PARAM)).toBe(false);
    expect(params.get(SORT_KEY_PARAM)).toBe('timeToFirstChunkMs');
  });

  it('drops a column the page no longer offers', () => {
    const view = tracesWith({
      columns: [
        ...(tracesView.columns ?? []),
        { id: 'removedColumn', visible: true },
        { id: 'custom.gone', visible: true },
      ],
    });
    expect(applySavedView(view, new URLSearchParams()).columns).toEqual(traceColumns);
  });

  it('drops metadata columns on the spans page, which has none', () => {
    const view: SavedViewState = {
      ...spansView,
      columns: [
        { id: 'model', visible: true },
        { id: 'metadata.region', visible: true },
      ],
    };
    expect(applySavedView(view, new URLSearchParams()).columns).toEqual({
      visibleColumns: ['model'],
      customColumns: [],
      metadataKeys: [],
    });
  });

  it('drops an option value the page does not know', () => {
    expect(applied(tracesWith({ options: { listMode: 'flat', other: true } })).has(TRACE_LIST_MODE_PARAM)).toBe(false);
  });
});

describe('a saved custom range', () => {
  it('is written the way the date picker writes it', () => {
    const view: SavedViewState = { ...spansView, dateRange: { from: '2026-10-01T02:00:00+02:00' } };
    const params = applySavedView(view, new URLSearchParams()).params;
    expect(params.get(TRACE_DATE_PRESET_PARAM)).toBe('custom');
    expect(params.get(TRACE_DATE_FROM_PARAM)).toBe(FROM);
    expect(params.has(TRACE_DATE_TO_PARAM)).toBe(false);
  });
});

describe("the page's default date preset", () => {
  it('is left out of the URL, as when the user picks it', () => {
    const view: SavedViewState = { ...spansView, dateRange: { preset: 'last-7d' } };
    expect(applySavedView(view, new URLSearchParams()).params.has(TRACE_DATE_PRESET_PARAM)).toBe(false);
  });
});
