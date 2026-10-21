import { z } from 'zod/v4';
import type { TracesFilters, TracesSortDirection } from './components/traces-explorer/traces-explorer-actions';
import type { TracesColumnsState } from './hooks/use-trace-columns-state';
import { isPresenceOperator, TRACE_DATE_PRESET_VALUES, traceFilterTokenOperator } from './trace-filters';
import type { TraceFilterGroup, TraceFilterNode, TraceFilterToken } from './trace-filters';
import { buildTraceListColumnKeys, isTraceCustomColumn, TRACE_OPTIONAL_COLUMNS } from './trace-list-columns';
import type { TraceColumnPreferences } from './trace-list-columns';
import { isTraceFilterGroup, isTraceFilterOperatorId } from './trace-query-filters';
import type { TraceDatePreset } from './types';
import { resolveKeyedOrder } from '@/ds/components/DataList/data-list-column-order';
import type { SavedView } from '@/ds/components/SavedViews';
import { toDate } from '@/utils/date-format';

/** The `page` saved trace views are stored under. */
export const TRACE_SAVED_VIEWS_PAGE = 'traces';

/** One filter of a saved view, as the filter bar shows it but without its UI ids. */
export type TraceSavedViewCondition = { fieldId: string; operatorId: string; value: string | string[] };
export type TraceSavedViewGroup = { kind: 'group'; logic: 'and' | 'or'; nodes: TraceSavedViewNode[] };
export type TraceSavedViewNode = TraceSavedViewCondition | TraceSavedViewGroup;

const conditionSchema = z.object({
  fieldId: z.string().min(1),
  operatorId: z.string().min(1),
  value: z.union([z.string(), z.array(z.string())]),
});
const nodeSchema: z.ZodType<TraceSavedViewNode> = z.lazy(() => z.union([groupSchema, conditionSchema]));
const groupSchema: z.ZodType<TraceSavedViewGroup> = z.object({
  kind: z.literal('group'),
  logic: z.enum(['and', 'or']),
  nodes: z.array(nodeSchema),
});

function canonicalColumns(preferences: {
  visibleColumns: readonly unknown[];
  customColumns: readonly unknown[];
  metadataKeys: readonly unknown[];
}): TraceColumnPreferences {
  const visible = new Set(preferences.visibleColumns);
  return {
    // Display order is fixed for these columns, so keep them in one order to compare views reliably.
    visibleColumns: TRACE_OPTIONAL_COLUMNS.filter(column => visible.has(column)),
    customColumns: [...new Set(preferences.customColumns.filter(isTraceCustomColumn))],
    metadataKeys: [
      ...new Set(preferences.metadataKeys.flatMap(key => (typeof key === 'string' && key.trim() ? [key.trim()] : []))),
    ],
  };
}

/**
 * A saved traces view's `state`.
 *
 * - `timeRange` and `filter` are the filter-bar state, not the API query, so a view works on every
 *   storage and reopens as chips. Filters a storage can't run reopen muted and stay in the view.
 * - `sort`, `columns` and `columnOrder` are the table setup. Columns this Studio doesn't know are
 *   dropped rather than dropping the whole view.
 */
export const traceSavedViewStateSchema = z.object({
  version: z.literal(1),
  timeRange: z.object({ preset: z.string(), from: z.string().optional(), to: z.string().optional() }),
  filter: z.object({ logic: z.literal('and'), nodes: z.array(nodeSchema) }),
  sort: z
    .object({ field: z.literal('startedAt'), direction: z.enum(['asc', 'desc']) })
    .catch({ field: 'startedAt', direction: 'desc' }),
  columns: z
    .object({
      visibleColumns: z.array(z.string()),
      customColumns: z.array(z.string()),
      metadataKeys: z.array(z.string()),
    })
    .transform(canonicalColumns),
  columnOrder: z.array(z.string()).catch([]),
});
export type TraceSavedViewState = z.infer<typeof traceSavedViewStateSchema>;

export type TraceSavedView = SavedView<TraceSavedViewState>;

/** What the traces page shows, and what a view puts back on it. */
export type TracesPageState = {
  filters: TracesFilters;
  sortDirection: TracesSortDirection;
  columns: TracesColumnsState;
};

// A chip whose value hasn't been picked yet is editor state, not a filter.
const hasValue = (token: TraceFilterToken) => {
  if (isPresenceOperator(traceFilterTokenOperator(token))) return true;
  return Array.isArray(token.value) ? token.value.length > 0 : token.value.trim() !== '';
};

const toCondition = (token: TraceFilterToken): TraceSavedViewCondition => ({
  fieldId: token.fieldId,
  operatorId: traceFilterTokenOperator(token),
  value: token.value,
});

function toSavedNode(node: TraceFilterNode): TraceSavedViewNode[] {
  if (!isTraceFilterGroup(node)) return hasValue(node) ? [toCondition(node)] : [];
  const nodes = node.nodes.flatMap(toSavedNode);
  return nodes.length > 0 ? [{ kind: 'group', logic: node.logic, nodes }] : [];
}

const isSavedGroup = (node: TraceSavedViewNode): node is TraceSavedViewGroup => 'kind' in node;

/** What a view saves of the page, including the filters this server can't run. */
export function toTraceSavedViewState({ filters, sortDirection, columns }: TracesPageState): TraceSavedViewState {
  const timeRange =
    filters.datePreset === 'custom'
      ? { preset: 'custom', from: filters.dateFrom?.toISOString(), to: filters.dateTo?.toISOString() }
      : { preset: filters.datePreset };
  const preferences = canonicalColumns(columns.preferences);
  const keys = buildTraceListColumnKeys(preferences);
  return {
    version: 1,
    timeRange,
    filter: { logic: 'and', nodes: [...filters.tokens, ...filters.groups].flatMap(toSavedNode) },
    sort: { field: 'startedAt', direction: sortDirection },
    columns: preferences,
    columnOrder: resolveKeyedOrder(columns.order, keys).map(index => keys[index] ?? ''),
  };
}

function toToken(condition: TraceSavedViewCondition, id?: string): TraceFilterToken | undefined {
  if (!isTraceFilterOperatorId(condition.operatorId)) return undefined;
  const token: TraceFilterToken = { ...(id ? { id } : {}), fieldId: condition.fieldId, value: condition.value };
  // Only a non-default operator is carried, as the filter bar does, so URLs stay short.
  return traceFilterTokenOperator(token) === condition.operatorId
    ? token
    : { ...token, operatorId: condition.operatorId };
}

/** `unreadable` counts the conditions left out because this Studio doesn't know their operator. */
function toGroup(group: TraceSavedViewGroup, id: string, unreadable: { count: number }): TraceFilterGroup {
  return {
    id,
    logic: group.logic,
    nodes: group.nodes.flatMap((node, index): TraceFilterNode[] => {
      const nodeId = `${id}-${index}`;
      if (isSavedGroup(node)) return [toGroup(node, nodeId, unreadable)];
      const token = toToken(node, nodeId);
      if (!token) unreadable.count += 1;
      return token ? [token] : [];
    }),
  };
}

function toDatePreset(preset: string, fallback: TraceDatePreset): TraceDatePreset {
  const known = [...TRACE_DATE_PRESET_VALUES].find(value => value === preset);
  return known && known !== 'all' ? known : fallback;
}

/**
 * The filters a view puts on the page, all of them: the explorer shows the ones this server can't
 * run muted. Only filters with an operator this Studio doesn't know (from a newer version) are
 * left out, and counted. `defaultDatePreset` replaces a time range this Studio doesn't know.
 */
export function traceFiltersFromSavedView(
  state: Pick<TraceSavedViewState, 'timeRange' | 'filter'>,
  defaultDatePreset: TraceDatePreset,
): { filters: TracesFilters; unreadableCount: number } {
  const tokens: TraceFilterToken[] = [];
  const groups: TraceFilterGroup[] = [];
  const unreadable = { count: 0 };
  state.filter.nodes.forEach((node, index) => {
    if (isSavedGroup(node)) {
      groups.push(toGroup(node, `saved-view-group-${index}`, unreadable));
      return;
    }
    const token = toToken(node);
    if (token) tokens.push(token);
    else unreadable.count += 1;
  });

  const datePreset = toDatePreset(state.timeRange.preset, defaultDatePreset);
  const filters: TracesFilters = {
    datePreset,
    ...(datePreset === 'custom' && {
      dateFrom: toDate(state.timeRange.from),
      dateTo: toDate(state.timeRange.to),
    }),
    tokens,
    groups,
  };
  return { filters, unreadableCount: unreadable.count };
}

/** What a view puts on the page. */
export function tracesPageStateFromView(
  state: TraceSavedViewState,
  defaultDatePreset: TraceDatePreset,
): TracesPageState {
  return {
    filters: traceFiltersFromSavedView(state, defaultDatePreset).filters,
    sortDirection: state.sort.direction,
    columns: { preferences: state.columns, order: state.columnOrder },
  };
}

/** A view's state as it looks once applied, to compare it with what the page shows. */
export function appliedTraceSavedViewState(
  state: TraceSavedViewState,
  defaultDatePreset: TraceDatePreset,
): TraceSavedViewState {
  return toTraceSavedViewState(tracesPageStateFromView(state, defaultDatePreset));
}
