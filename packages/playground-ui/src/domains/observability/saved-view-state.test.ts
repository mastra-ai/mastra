import { savedViewStateSchema } from '@mastra/core/storage';
import type { FilterNode, SavedViewState } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  FROM,
  listGroups,
  logsView,
  pages,
  spansView,
  traceColumns,
  tracesView,
} from './__tests__/fixtures/saved-view-pages';
import { applySavedView, savedViewFromSearchParams } from './saved-view-state';
import {
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_TO_PARAM,
  TRACE_LIST_MODE_PARAM,
} from '@/domains/traces/trace-filters';
import { DEFAULT_TRACE_COLUMN_PREFERENCES } from '@/domains/traces/trace-list-columns';
import type { TraceColumnPreferences } from '@/domains/traces/trace-list-columns';
import { SORT_DIR_PARAM, SORT_KEY_PARAM } from '@/lib/sort/use-url-sort';

const sorted = (params: URLSearchParams) => {
  const copy = new URLSearchParams(params);
  copy.sort();
  return copy.toString();
};

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
