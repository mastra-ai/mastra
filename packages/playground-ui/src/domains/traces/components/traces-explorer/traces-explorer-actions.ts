import {
  buildTraceListFilters,
  ROOT_ENTITY_TYPE_OPTIONS,
  TRACE_LEGACY_FILTER_FIELD_IDS,
  TRACE_STATUS_VALUES,
  traceFilterTokenOperator,
} from '../../trace-filters';
import type { EntityOptions, TraceFilterGroup, TraceFilterToken, TraceStatusFilter } from '../../trace-filters';
import { buildTraceQueryRequest, TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS } from '../../trace-query-filters';
import type { SpanTab, TraceDatePreset } from '../../types';
import type { TraceSpanView } from '../trace-data-panel-view';
import { isFilterBarGroup } from '@/ds/components/FilterBar';
import type { FilterBarItem, FilterBarNode } from '@/ds/components/FilterBar';

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

const ROOT_DURATION_FIELD_IDS: ReadonlySet<string> = new Set(['durationMs']);
const NO_FIELD_IDS: ReadonlySet<string> = new Set();

/** Fields this server can't query on top of the always-unsupported ones: root duration needs its capability. */
const serverUnqueryableFieldIds = (withRootDuration: boolean) =>
  withRootDuration ? NO_FIELD_IDS : ROOT_DURATION_FIELD_IDS;

/** Which list API the server serves traces through, and what it can filter on. */
export type TracesQuerySupport = {
  /** The trace query API: AND/OR groups and every filter bar field. Otherwise the legacy list endpoint. */
  withQueryTrace: boolean;
  withRootDuration: boolean;
};

/** Shown on a filter this server's storage can't run, e.g. AND/OR groups without the trace query API. */
export const TRACE_FILTER_NOT_ON_THIS_STORAGE = 'Not supported on this storage';
const TRACE_FILTER_NEVER_QUERYABLE = "Traces can't be filtered this way";

const legacyUnsupportedReason = ({ fieldId, operatorId, value }: FilterBarItem): string | undefined => {
  if (!TRACE_LEGACY_FILTER_FIELD_IDS.has(fieldId)) return TRACE_FILTER_NOT_ON_THIS_STORAGE;
  // Tags take a list; every other legacy field takes one value with `is`.
  if (fieldId === 'tags') return undefined;
  return operatorId === 'is' && typeof value === 'string' ? undefined : TRACE_FILTER_NOT_ON_THIS_STORAGE;
};

/** Why this server can't run a filter bar item or root AND/OR group, or `undefined` when it can. */
export const unsupportedTraceFilterReason = (node: FilterBarNode, support: TracesQuerySupport): string | undefined => {
  if (isFilterBarGroup(node)) return support.withQueryTrace ? undefined : TRACE_FILTER_NOT_ON_THIS_STORAGE;
  if (!support.withQueryTrace) return legacyUnsupportedReason(node);
  if (node.fieldId === 'status' && node.value === 'running') return TRACE_FILTER_NEVER_QUERYABLE;
  if (TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS.has(node.fieldId)) return TRACE_FILTER_NEVER_QUERYABLE;
  if (serverUnqueryableFieldIds(support.withRootDuration).has(node.fieldId)) return TRACE_FILTER_NOT_ON_THIS_STORAGE;
  return undefined;
};

/**
 * Drops what this server can't run, so it's left out of the list query: top-level tokens, and
 * every group on the legacy endpoint. The filter bar still shows them, muted (see
 * `unsupportedTraceFilterReason`), and edits keep them. With the trace query API,
 * `buildTracesQueryRequest` leaves a group's unqueryable conditions out. Returns the same object
 * when nothing is dropped.
 */
export const sanitizeTracesFilters = (filters: TracesFilters, support: TracesQuerySupport): TracesFilters => {
  const tokens = filters.tokens.filter(
    token =>
      unsupportedTraceFilterReason(
        { id: token.fieldId, fieldId: token.fieldId, operatorId: traceFilterTokenOperator(token), value: token.value },
        support,
      ) === undefined,
  );
  const groups = support.withQueryTrace ? filters.groups : [];
  if (tokens.length === filters.tokens.length && groups.length === filters.groups.length) return filters;
  return { ...filters, tokens, groups };
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

type TracesQueryWindow = { filters: TracesFilters; dateFrom?: Date; dateTo?: Date };

/** The trace query for the (sanitized) filters and the resolved date window. */
export const buildTracesQueryRequest = ({
  filters,
  dateFrom,
  dateTo,
  withRootDuration,
  now,
}: TracesQueryWindow & { withRootDuration: boolean; now: Date }) =>
  buildTraceQueryRequest({
    rootEntityType: getSelectedEntityOption(filters.tokens)?.entityType,
    status: getSelectedStatus(filters.tokens),
    dateFrom,
    dateTo,
    tokens: filters.tokens,
    groups: filters.groups,
    excludedFieldIds: serverUnqueryableFieldIds(withRootDuration),
    now,
  });

/** The `listTracesLight` filters for servers without the trace query API (no groups there). */
export const buildTracesLegacyFilters = ({ filters, dateFrom, dateTo }: TracesQueryWindow) =>
  buildTraceListFilters({
    rootEntityType: getSelectedEntityOption(filters.tokens)?.entityType,
    status: getSelectedStatus(filters.tokens),
    dateFrom,
    dateTo,
    tokens: filters.tokens,
  });

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
