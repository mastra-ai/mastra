import { ROOT_ENTITY_TYPE_OPTIONS, TRACE_STATUS_VALUES } from '../../trace-filters';
import type { EntityOptions, TraceFilterGroup, TraceFilterToken, TraceStatusFilter } from '../../trace-filters';
import { TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS } from '../../trace-query-filters';
import type { SpanTab, TraceDatePreset } from '../../types';
import type { TraceSpanView } from '../trace-data-panel-view';

export type TracesSelection = {
  traceId?: string;
  spanId?: string;
  spanTab?: SpanTab;
  spanView: TraceSpanView;
  scoreId?: string;
  highlightSpanIds: string[];
};

/** `rootEntityType` and `status` are tokens too (`fieldId: 'rootEntityType' | 'status'`), like every other filter. */
export type TracesFilters = {
  datePreset: TraceDatePreset;
  /** Only read when `datePreset` is `custom`. */
  dateFrom?: Date;
  /** Only read when `datePreset` is `custom`. */
  dateTo?: Date;
  tokens: TraceFilterToken[];
  groups: TraceFilterGroup[];
};

export type TracesSortDirection = 'asc' | 'desc';

/** What the explorer emits on every change: filters and selection move together (a filter edit clears the selection). */
export type TracesExplorerState = { selection: TracesSelection; filters: TracesFilters };

export const EMPTY_TRACES_SELECTION: TracesSelection = { spanView: 'tree', highlightSpanIds: [] };

export const DEFAULT_TRACES_FILTERS: TracesFilters = { datePreset: 'last-7d', tokens: [], groups: [] };

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_MS: Partial<Record<TraceDatePreset, number>> = {
  'last-24h': DAY_MS,
  'last-3d': 3 * DAY_MS,
  'last-7d': 7 * DAY_MS,
  'last-14d': 14 * DAY_MS,
  'last-30d': 30 * DAY_MS,
};

export const isSelectionEmpty = (selection: TracesSelection) =>
  !selection.traceId &&
  !selection.spanId &&
  !selection.spanTab &&
  !selection.scoreId &&
  selection.highlightSpanIds.length === 0;

/** Keeps the span view: it is a display preference, not part of what is selected. */
export const clearSelection = (selection: TracesSelection): TracesSelection => ({
  spanView: selection.spanView,
  highlightSpanIds: [],
});

export const selectTrace = (selection: TracesSelection, traceId: string | null): TracesSelection =>
  traceId ? { traceId, spanView: selection.spanView, highlightSpanIds: [] } : clearSelection(selection);

/** Tab and score belong to the previous span, so they are dropped with it. */
export const selectSpan = (selection: TracesSelection, spanId: string | null): TracesSelection => {
  if ((spanId ?? undefined) === selection.spanId) return selection;
  return { ...selection, spanId: spanId ?? undefined, spanTab: undefined, scoreId: undefined };
};

export const setSpanTab = (selection: TracesSelection, tab: SpanTab): TracesSelection => {
  if (tab === selection.spanTab) return selection;
  return { ...selection, spanTab: tab === 'details' ? undefined : tab, scoreId: undefined };
};

export const setSpanView = (selection: TracesSelection, spanView: TraceSpanView): TracesSelection =>
  spanView === selection.spanView ? selection : { ...selection, spanView };

export const selectScore = (selection: TracesSelection, scoreId: string | null): TracesSelection =>
  (scoreId ?? undefined) === selection.scoreId ? selection : { ...selection, scoreId: scoreId ?? undefined };

export const highlightSpans = (selection: TracesSelection, spanIds: string[]): TracesSelection => {
  const unchanged =
    spanIds.length === selection.highlightSpanIds.length &&
    spanIds.every((id, index) => id === selection.highlightSpanIds[index]);
  return unchanged ? selection : { ...selection, highlightSpanIds: spanIds };
};

export const applyFilterTokens = (
  filters: TracesFilters,
  tokens: TraceFilterToken[],
  groups: TraceFilterGroup[],
): TracesFilters => ({ ...filters, tokens, groups });

/** Switching to `custom` keeps the current dates so the picker opens on them; any other preset drops them. */
export const applyDatePreset = (filters: TracesFilters, datePreset: TraceDatePreset): TracesFilters =>
  datePreset === 'custom' ? { ...filters, datePreset } : { datePreset, tokens: filters.tokens, groups: filters.groups };

// The picker can report a date right after switching away from `custom`; those are ignored.
export const applyDate = (filters: TracesFilters, date: Date | undefined, end: 'from' | 'to'): TracesFilters => {
  if (filters.datePreset !== 'custom') return filters;
  return end === 'from' ? { ...filters, dateFrom: date } : { ...filters, dateTo: date };
};

export const applyDateRange = (
  filters: TracesFilters,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
): TracesFilters => (filters.datePreset === 'custom' ? { ...filters, dateFrom, dateTo } : filters);

const isQueryableToken = (token: TraceFilterToken, withRootDuration: boolean) => {
  if (token.fieldId === 'status' && token.value === 'running') return false;
  if (TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS.has(token.fieldId)) return false;
  if (token.fieldId === 'durationMs' && !withRootDuration) return false;
  return true;
};

/**
 * Drops the top-level tokens the trace query can't run. Groups pass through: the query builder
 * already skips excluded fields inside them. Returns the same object when nothing is dropped.
 */
export const sanitizeTracesFilters = (filters: TracesFilters, withRootDuration: boolean): TracesFilters => {
  const tokens = filters.tokens.filter(token => isQueryableToken(token, withRootDuration));
  return tokens.length === filters.tokens.length ? filters : { ...filters, tokens };
};

const tokenValue = (tokens: TraceFilterToken[], fieldId: string) => {
  const value = tokens.find(token => token.fieldId === fieldId)?.value;
  return typeof value === 'string' ? value : undefined;
};

export const getSelectedEntityOption = (tokens: TraceFilterToken[]): EntityOptions | undefined => {
  const value = tokenValue(tokens, 'rootEntityType');
  return ROOT_ENTITY_TYPE_OPTIONS.find(option => option.entityType === value);
};

export const getSelectedStatus = (tokens: TraceFilterToken[]): TraceStatusFilter | undefined => {
  const value = tokenValue(tokens, 'status');
  return value && TRACE_STATUS_VALUES.has(value as TraceStatusFilter) ? (value as TraceStatusFilter) : undefined;
};

/** Rolling presets start `PRESET_MS` before now and stay open-ended; `all` is open on both ends. */
export const resolveTracesDateWindow = (
  datePreset: TraceDatePreset,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
): { dateFrom?: Date; dateTo?: Date } => {
  if (datePreset === 'custom') return { dateFrom, dateTo };
  const ms = PRESET_MS[datePreset];
  return { dateFrom: ms ? new Date(Date.now() - ms) : undefined, dateTo: undefined };
};
