import { DEFAULT_TRACES_FILTERS } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesExplorerState,
  TracesFilters,
  TracesSelection,
  TracesSortDirection,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import {
  TRACE_ANCHOR_SPAN_ID_PARAM,
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_PRESET_VALUES,
  TRACE_DATE_TO_PARAM,
  applyTracePropertyFilterTokens,
  getTraceFilterGroups,
  getTracePropertyFilterTokens,
} from '@mastra/playground-ui/domains/traces/trace-filters';
import { SORT_DIR_PARAM, SORT_KEY_PARAM, readUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import type { SetURLSearchParamsLike } from '@mastra/playground-ui/sort/use-url-sort';
import { useMemo } from 'react';

type TraceDatePreset = TracesFilters['datePreset'];

const TRACE_ID_PARAM = 'traceId';
const SPAN_ID_PARAM = 'spanId';
const TAB_PARAM = 'tab';
const SPAN_VIEW_PARAM = 'spanView';
const SCORE_ID_PARAM = 'scoreId';
const HIGHLIGHT_SPAN_IDS_PARAM = 'highlightSpanIds';
const PAGE_PARAM = 'page';

const TRACES_SORT_KEYS = ['startedAt'] as const;
const DEFAULT_TRACES_SORT = { key: 'startedAt', direction: 'desc' } as const;

const SELECTION_PARAMS = [
  TRACE_ID_PARAM,
  SPAN_ID_PARAM,
  TRACE_ANCHOR_SPAN_ID_PARAM,
  TAB_PARAM,
  SPAN_VIEW_PARAM,
  SCORE_ID_PARAM,
  HIGHLIGHT_SPAN_IDS_PARAM,
];
const NON_FILTER_PARAMS = new Set([...SELECTION_PARAMS, SORT_KEY_PARAM, SORT_DIR_PARAM, PAGE_PARAM]);

function pickParams(params: URLSearchParams, keep: (key: string) => boolean): string {
  const picked = new URLSearchParams();
  for (const [key, value] of params) {
    if (keep(key)) picked.append(key, value);
  }
  return picked.toString();
}

function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function decodeFilters(params: URLSearchParams): TracesFilters {
  const preset = params.get(TRACE_DATE_PRESET_PARAM);
  const datePreset =
    preset && preset !== 'all' && TRACE_DATE_PRESET_VALUES.has(preset as TraceDatePreset)
      ? (preset as TraceDatePreset)
      : DEFAULT_TRACES_FILTERS.datePreset;
  return {
    datePreset,
    dateFrom: parseDate(params.get(TRACE_DATE_FROM_PARAM)),
    dateTo: parseDate(params.get(TRACE_DATE_TO_PARAM)),
    tokens: getTracePropertyFilterTokens(params),
    groups: getTraceFilterGroups(params),
  };
}

function decodeSelection(params: URLSearchParams): TracesSelection {
  const tab = params.get(TAB_PARAM);
  const highlight = params.get(HIGHLIGHT_SPAN_IDS_PARAM);
  return {
    traceId: params.get(TRACE_ID_PARAM) || undefined,
    spanId: params.get(SPAN_ID_PARAM) || undefined,
    spanTab: tab === 'feedback' || tab === 'details' ? tab : undefined,
    spanView: params.get(SPAN_VIEW_PARAM) === 'timeline' ? 'timeline' : 'tree',
    scoreId: params.get(SCORE_ID_PARAM) || undefined,
    highlightSpanIds: highlight ? highlight.split(',').filter(Boolean) : [],
  };
}

function setOrDelete(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) params.set(key, value);
  else params.delete(key);
}

function encodeFilters(base: URLSearchParams, filters: TracesFilters): URLSearchParams {
  const next = new URLSearchParams(base);
  setOrDelete(
    next,
    TRACE_DATE_PRESET_PARAM,
    filters.datePreset === DEFAULT_TRACES_FILTERS.datePreset ? undefined : filters.datePreset,
  );
  setOrDelete(next, TRACE_DATE_FROM_PARAM, filters.dateFrom?.toISOString());
  setOrDelete(next, TRACE_DATE_TO_PARAM, filters.dateTo?.toISOString());
  // Wipes every filter param and re-adds them in token order, so URL order == creation order.
  applyTracePropertyFilterTokens(next, filters.tokens, filters.groups);
  return next;
}

function encodeSelection(base: URLSearchParams, selection: TracesSelection): URLSearchParams {
  const next = new URLSearchParams(base);
  // A different trace resets the branch context; span navigation inside the trace keeps it.
  if ((base.get(TRACE_ID_PARAM) || undefined) !== selection.traceId) next.delete(TRACE_ANCHOR_SPAN_ID_PARAM);
  setOrDelete(next, TRACE_ID_PARAM, selection.traceId);
  setOrDelete(next, SPAN_ID_PARAM, selection.spanId);
  setOrDelete(next, TAB_PARAM, selection.spanTab === 'details' ? undefined : selection.spanTab);
  setOrDelete(next, SPAN_VIEW_PARAM, selection.spanView === 'timeline' ? 'timeline' : undefined);
  setOrDelete(next, SCORE_ID_PARAM, selection.scoreId);
  setOrDelete(next, HIGHLIGHT_SPAN_IDS_PARAM, selection.highlightSpanIds.join(','));
  return next;
}

function encodeSortDirection(base: URLSearchParams, direction: TracesSortDirection): URLSearchParams {
  const next = new URLSearchParams(base);
  next.set(SORT_KEY_PARAM, DEFAULT_TRACES_SORT.key);
  next.set(SORT_DIR_PARAM, direction);
  next.delete(PAGE_PARAM);
  return next;
}

/**
 * URL codec for the traces explorer: decodes search params into the explorer's controlled
 * `selection` / `filters` / `sortDirection` values and encodes their changes back.
 *
 * Each value is memoized on only the params it reads, so a trace click doesn't hand the explorer
 * new filters and vice versa. The explorer emits its full state once per action, and each write
 * rewrites every filter and selection param, so when it emits twice in a tick the last write wins.
 *
 * `setState` goes through `setPersistedSearchParams`; sort is not persisted.
 */
export function useTracesRouteState(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
  setPersistedSearchParams: SetURLSearchParamsLike,
) {
  const filtersKey = pickParams(searchParams, key => !NON_FILTER_PARAMS.has(key));
  const selectionKey = pickParams(searchParams, key => SELECTION_PARAMS.includes(key));

  const filters = useMemo(() => decodeFilters(new URLSearchParams(filtersKey)), [filtersKey]);
  const selection = useMemo(() => decodeSelection(new URLSearchParams(selectionKey)), [selectionKey]);
  const sortDirection: TracesSortDirection =
    readUrlSort(searchParams, TRACES_SORT_KEYS, DEFAULT_TRACES_SORT)?.direction ?? DEFAULT_TRACES_SORT.direction;

  const setState = (next: TracesExplorerState) =>
    setPersistedSearchParams(encodeSelection(encodeFilters(searchParams, next.filters), next.selection), {
      replace: true,
    });
  const setSortDirection = (next: TracesSortDirection) =>
    setSearchParams(encodeSortDirection(searchParams, next), { replace: true });

  return { selection, filters, setState, sortDirection, setSortDirection };
}
