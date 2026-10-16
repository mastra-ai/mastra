import type {
  AggregateTracesArgs,
  AggregateTracesResponse,
  QueryTracesInput,
  TraceAggregateDiscovery,
} from '@mastra/client-js';
import type { TraceFilterOperatorId } from './trace-filters';
import {
  ROOT_ENTITY_TYPE_OPTIONS,
  TRACE_GROUP_BY_PARAM,
  TRACE_GROUP_HAVING_PARAM,
  TRACE_GROUP_SORT_PARAM,
  TRACE_PROPERTY_FILTER_PARAM_BY_FIELD,
  TRACE_ROOT_ENTITY_TYPE_PARAM,
  TRACE_STATUS_PARAM,
  traceFilterOperatorParam,
} from './trace-filters';
import { formatCompactNumber, formatCost, formatFullNumber } from '@/lib/cost';
import { formatPercent } from '@/lib/number';
import { formatDuration } from '@/utils/duration';

export { TRACE_GROUP_BY_PARAM, TRACE_GROUP_HAVING_PARAM, TRACE_GROUP_SORT_PARAM };

/** Dimensions the Traces table offers in its Group by menu when the server supports them. */
export const TRACE_GROUP_BY_DIMENSIONS = ['entityName', 'status', 'environment', 'entityType'] as const;

/** Dimensions a page may add for its own scope, e.g. `projectId` on an organization-wide view. */
export type TraceGroupByExtraDimension = 'projectId';

export type TraceGroupByDimension = (typeof TRACE_GROUP_BY_DIMENSIONS)[number] | TraceGroupByExtraDimension;

export const TRACE_GROUP_BY_DIMENSION_LABELS: Record<TraceGroupByDimension, string> = {
  entityName: 'Entity',
  status: 'Status',
  environment: 'Environment',
  entityType: 'Entity type',
  projectId: 'Project',
};

/** Every measure the grouped view can show as a column, in menu order. */
export const TRACE_GROUP_BY_MEASURES = [
  'count',
  'errorCount',
  'errorRate',
  'duration.avg',
  'duration.min',
  'duration.max',
  'duration.p50',
  'duration.p90',
  'duration.p95',
  'duration.p99',
  'tokens.input.sum',
  'tokens.input.avg',
  'tokens.output.sum',
  'tokens.output.avg',
  'tokens.total.sum',
  'tokens.total.avg',
  'tokens.reasoning.sum',
  'tokens.reasoning.avg',
  'tokens.cached.sum',
  'tokens.cached.avg',
  'cost.sum',
  'cost.avg',
  'countDistinct.entityName',
  'countDistinct.threadId',
  'countDistinct.resourceId',
  'countDistinct.userId',
  'countDistinct.sessionId',
] as const satisfies AggregateTracesArgs['measures'];

export type TraceGroupByMeasure = (typeof TRACE_GROUP_BY_MEASURES)[number];

const COUNT_DISTINCT_PREFIX = 'countDistinct.';

/** Columns shown until the user picks others. */
export const DEFAULT_TRACE_GROUP_COLUMNS: readonly TraceGroupByMeasure[] = [
  'count',
  'errorRate',
  'duration.p50',
  'duration.p95',
  'tokens.input.sum',
  'tokens.output.sum',
  'cost.sum',
];

export const TRACE_GROUP_BY_MEASURE_LABELS: Record<TraceGroupByMeasure, string> = {
  count: 'Traces',
  errorCount: 'Errors',
  errorRate: 'Error rate',
  'duration.avg': 'Avg duration',
  'duration.min': 'Min duration',
  'duration.max': 'Max duration',
  'duration.p50': 'p50 duration',
  'duration.p90': 'p90 duration',
  'duration.p95': 'p95 duration',
  'duration.p99': 'p99 duration',
  'tokens.input.sum': 'Input tokens',
  'tokens.input.avg': 'Avg input tokens',
  'tokens.output.sum': 'Output tokens',
  'tokens.output.avg': 'Avg output tokens',
  'tokens.total.sum': 'Total tokens',
  'tokens.total.avg': 'Avg total tokens',
  'tokens.reasoning.sum': 'Reasoning tokens',
  'tokens.reasoning.avg': 'Avg reasoning tokens',
  'tokens.cached.sum': 'Cached tokens',
  'tokens.cached.avg': 'Avg cached tokens',
  'cost.sum': 'Cost',
  'cost.avg': 'Avg cost',
  'countDistinct.entityName': 'Entities',
  'countDistinct.threadId': 'Threads',
  'countDistinct.resourceId': 'Resources',
  'countDistinct.userId': 'Users',
  'countDistinct.sessionId': 'Sessions',
};

/** Sections of the grouped view's Columns menu. */
export const TRACE_GROUP_COLUMN_SECTIONS: ReadonlyArray<{ label: string; measures: readonly TraceGroupByMeasure[] }> = [
  { label: 'Traces', measures: ['count', 'errorCount', 'errorRate'] },
  {
    label: 'Duration',
    measures: [
      'duration.avg',
      'duration.min',
      'duration.max',
      'duration.p50',
      'duration.p90',
      'duration.p95',
      'duration.p99',
    ],
  },
  {
    label: 'Tokens',
    measures: [
      'tokens.input.sum',
      'tokens.input.avg',
      'tokens.output.sum',
      'tokens.output.avg',
      'tokens.total.sum',
      'tokens.total.avg',
      'tokens.reasoning.sum',
      'tokens.reasoning.avg',
      'tokens.cached.sum',
      'tokens.cached.avg',
    ],
  },
  { label: 'Cost', measures: ['cost.sum', 'cost.avg'] },
  {
    label: 'Unique counts',
    measures: [
      'countDistinct.entityName',
      'countDistinct.threadId',
      'countDistinct.resourceId',
      'countDistinct.userId',
      'countDistinct.sessionId',
    ],
  },
];

/** Parse saved column choices: known measures in menu order, always including the trace count. */
export function parseTraceGroupColumns(value: unknown): TraceGroupByMeasure[] {
  if (!Array.isArray(value)) return [...DEFAULT_TRACE_GROUP_COLUMNS];
  return TRACE_GROUP_BY_MEASURES.filter(measure => measure === 'count' || value.includes(measure));
}

export type TraceGroupSortDirection = 'asc' | 'desc';
export type TraceGroupSort = { measure: TraceGroupByMeasure; direction: TraceGroupSortDirection };

export const DEFAULT_TRACE_GROUP_SORT: TraceGroupSort = { measure: 'count', direction: 'desc' };

/** Top-N groups returned per request; the response is `truncated` when more exist. */
export const TRACE_GROUP_BY_LIMIT = 50;

export const TRACE_GROUP_NOT_SET_LABEL = '(not set)';

/** The server groups by at most two dimensions per request. */
export const TRACE_GROUP_BY_MAX_DIMENSIONS = 2;

export const TRACE_GROUP_HAVING_OPERATORS = ['gt', 'gte', 'lt', 'lte'] as const;
export type TraceGroupHavingOperator = (typeof TRACE_GROUP_HAVING_OPERATORS)[number];

/** A filter on the groups themselves, e.g. error rate above 0.25. `value` is in the measure's own unit. */
export type TraceGroupHaving = { measure: TraceGroupByMeasure; operatorId: TraceGroupHavingOperator; value: number };

/** The grouped view: what to group by (in order) and which groups to keep. */
export type TraceGrouping = { groupBy: TraceGroupByDimension[]; having: TraceGroupHaving[] };

const isTraceGroupHavingOperator = (value: string): value is TraceGroupHavingOperator =>
  (TRACE_GROUP_HAVING_OPERATORS as readonly string[]).includes(value);

const isTraceGroupByMeasure = (value: string): value is TraceGroupByMeasure =>
  (TRACE_GROUP_BY_MEASURES as readonly string[]).includes(value);

/**
 * The dimensions to offer: the allowlist plus the page's extra dimensions, narrowed to what discovery reports
 * when the server reports it. Extra dimensions are only offered when discovery lists them, since servers that
 * predate them reject the request.
 */
export function getOfferedTraceGroupByDimensions({
  discovery,
  extraDimensions = [],
}: {
  discovery?: TraceAggregateDiscovery;
  extraDimensions?: readonly TraceGroupByExtraDimension[];
}): TraceGroupByDimension[] {
  if (!discovery) return [...TRACE_GROUP_BY_DIMENSIONS];
  const reported = new Set(discovery.dimensions.map(dimension => dimension.path));
  return [...TRACE_GROUP_BY_DIMENSIONS, ...extraDimensions].filter(dimension => reported.has(dimension));
}

/**
 * Measures the grouped view can show as columns. Without discovery every column is offered; with it, only the
 * measures it lists, and unique counts only for fields it can group by.
 */
export function getOfferedTraceGroupColumns(discovery?: TraceAggregateDiscovery): TraceGroupByMeasure[] {
  if (!discovery) return [...TRACE_GROUP_BY_MEASURES];
  const measures = new Set(discovery.measures.map(measure => measure.name));
  const dimensions = new Set(discovery.dimensions.map(dimension => dimension.path));
  return TRACE_GROUP_BY_MEASURES.filter(measure =>
    measure.startsWith(COUNT_DISTINCT_PREFIX)
      ? dimensions.has(measure.slice(COUNT_DISTINCT_PREFIX.length))
      : measures.has(measure),
  );
}

/** The dimensions to group by, in order: offered ones only, without repeats, at most two. */
export function parseTraceGroupBy(
  params: URLSearchParams,
  offered: readonly TraceGroupByDimension[],
): TraceGroupByDimension[] {
  const requested = (params.get(TRACE_GROUP_BY_PARAM) ?? '').split(',');
  const dimensions: TraceGroupByDimension[] = [];
  for (const value of requested) {
    const dimension = offered.find(candidate => candidate === value);
    if (dimension && !dimensions.includes(dimension)) dimensions.push(dimension);
  }
  return dimensions.slice(0, TRACE_GROUP_BY_MAX_DIMENSIONS);
}

/** Group filters from `groupHaving=<measure>:<op>:<value>,…`. Malformed entries are dropped. */
export function parseTraceGroupHaving(params: URLSearchParams): TraceGroupHaving[] {
  const raw = params.get(TRACE_GROUP_HAVING_PARAM);
  if (!raw) return [];
  const having: TraceGroupHaving[] = [];
  for (const entry of raw.split(',')) {
    const [measure = '', operatorId = '', text = ''] = entry.split(':');
    const value = Number(text);
    if (!isTraceGroupByMeasure(measure) || !isTraceGroupHavingOperator(operatorId)) continue;
    if (text === '' || !Number.isFinite(value)) continue;
    if (having.some(existing => existing.measure === measure)) continue;
    having.push({ measure, operatorId, value });
  }
  return having;
}

const serializeTraceGroupHaving = (having: readonly TraceGroupHaving[]) =>
  having.map(({ measure, operatorId, value }) => `${measure}:${operatorId}:${value}`).join(',');

/** Write the grouped view into `params`. Group filters only exist while grouped. */
export function writeTraceGrouping(params: URLSearchParams, { groupBy, having }: TraceGrouping): void {
  const dimensions = groupBy.slice(0, TRACE_GROUP_BY_MAX_DIMENSIONS);
  if (dimensions.length === 0) {
    params.delete(TRACE_GROUP_BY_PARAM);
    params.delete(TRACE_GROUP_HAVING_PARAM);
    return;
  }
  params.set(TRACE_GROUP_BY_PARAM, dimensions.join(','));
  if (having.length === 0) params.delete(TRACE_GROUP_HAVING_PARAM);
  else params.set(TRACE_GROUP_HAVING_PARAM, serializeTraceGroupHaving(having));
}

export function parseTraceGroupSort(params: URLSearchParams): TraceGroupSort {
  const raw = params.get(TRACE_GROUP_SORT_PARAM);
  if (!raw) return DEFAULT_TRACE_GROUP_SORT;
  const separator = raw.lastIndexOf(':');
  const measure = raw.slice(0, separator);
  const direction = raw.slice(separator + 1);
  if (separator < 0 || !isTraceGroupByMeasure(measure) || (direction !== 'asc' && direction !== 'desc')) {
    return DEFAULT_TRACE_GROUP_SORT;
  }
  return { measure, direction };
}

export const serializeTraceGroupSort = ({ measure, direction }: TraceGroupSort) => `${measure}:${direction}`;

/** The grouped request for the same selection (`timeRange` + `where`) as the trace list. */
export function buildTraceGroupByRequest(
  query: Pick<QueryTracesInput, 'timeRange' | 'where'>,
  { groupBy, having }: TraceGrouping,
  sort: TraceGroupSort,
  columns: readonly TraceGroupByMeasure[] = DEFAULT_TRACE_GROUP_COLUMNS,
): AggregateTracesArgs {
  const comparisons = having.map(({ measure, operatorId, value }) => ({
    op: operatorId,
    left: { path: measure },
    right: { literal: value },
  }));
  return {
    timeRange: query.timeRange,
    ...(query.where ? { where: query.where } : {}),
    groupBy: groupBy.slice(0, TRACE_GROUP_BY_MAX_DIMENSIONS),
    // The visible columns, plus whatever the sort and group filters read.
    measures: [...new Set<TraceGroupByMeasure>([...columns, sort.measure, ...having.map(entry => entry.measure)])],
    ...(comparisons.length === 1 ? { having: comparisons[0] } : {}),
    ...(comparisons.length > 1 ? { having: { op: 'and' as const, args: comparisons } } : {}),
    orderBy: { field: sort.measure, direction: sort.direction },
    limit: TRACE_GROUP_BY_LIMIT,
  };
}

export type TraceGroupRow = AggregateTracesResponse['rows'][number];

/**
 * The group's value for a dimension; undefined when the traces don't set it. Traces without an `entityName` (e.g.
 * scorer runs recorded before scorers set one) are labelled by `entityId` when the entityId fallback split them out.
 */
export const getTraceGroupValue = (row: TraceGroupRow, dimension: TraceGroupByDimension): string | undefined =>
  row.dimensions?.[dimension] || (dimension === 'entityName' ? row.dimensions?.entityId : undefined) || undefined;

/**
 * Whether to split unnamed groups by `entityId`. Like the offered dimensions, a server that doesn't describe its
 * aggregate dimensions is assumed to support it; if it rejects the split, the "(not set)" group stays.
 */
export const supportsTraceGroupEntityIdFallback = (discovery: TraceAggregateDiscovery | undefined): boolean =>
  discovery?.dimensions.some(dimension => dimension.path === 'entityId') ?? true;

const UNNAMED = { op: 'notExists', path: 'entityName' } as const;

/**
 * When grouping by `entityName` returned a group of traces with no name, the request that splits those traces by
 * `entityId` instead. It only runs when such a group exists and reads only the unnamed traces.
 */
export function buildTraceGroupEntityIdFallbackRequest(
  request: AggregateTracesArgs,
  response: AggregateTracesResponse | undefined,
): AggregateTracesArgs | undefined {
  if (!request.groupBy?.includes('entityName')) return undefined;
  if (!response?.rows.some(row => !row.dimensions?.entityName)) return undefined;
  return {
    ...request,
    where: request.where ? { op: 'and', args: [request.where, UNNAMED] } : UNNAMED,
    groupBy: request.groupBy.map(dimension => (dimension === 'entityName' ? 'entityId' : dimension)),
  };
}

const compareMeasure = (a: TraceGroupRow, b: TraceGroupRow, { measure, direction }: TraceGroupSort) => {
  const left = a.measures?.[measure];
  const right = b.measures?.[measure];
  // Like the server, groups without a value sort last in either direction.
  if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
  return direction === 'asc' ? left - right : right - left;
};

/** Replace the unnamed groups with their per-`entityId` split, re-sorted and cut to the view's limit. */
export function mergeTraceGroupEntityIdFallback(
  response: AggregateTracesResponse,
  fallback: AggregateTracesResponse,
  sort: TraceGroupSort,
): AggregateTracesResponse {
  const rows = [...response.rows.filter(row => row.dimensions?.entityName), ...fallback.rows].sort((a, b) =>
    compareMeasure(a, b, sort),
  );
  return {
    rows: rows.slice(0, TRACE_GROUP_BY_LIMIT),
    truncated: response.truncated || fallback.truncated || rows.length > TRACE_GROUP_BY_LIMIT,
  };
}

const STATUS_LABELS: Record<string, string> = { success: 'Success', error: 'Error' };

export function formatTraceGroupValue(dimension: TraceGroupByDimension, value: string | undefined): string {
  if (value === undefined) return TRACE_GROUP_NOT_SET_LABEL;
  if (dimension === 'status') return STATUS_LABELS[value] ?? value;
  if (dimension === 'entityType') {
    return ROOT_ENTITY_TYPE_OPTIONS.find(option => option.entityType === value)?.label ?? value;
  }
  return value;
}

export type TraceGroupFilter = { param: string; value: string; operatorId: TraceFilterOperatorId };

type TraceDimensionDrillDown = { kind: 'filter'; filter: TraceGroupFilter } | { kind: 'project'; projectId: string };

/** How one dimension's value narrows the trace list, or undefined when the list's filters can't express it. */
function getTraceDimensionDrillDown(
  dimension: TraceGroupByDimension,
  value: string | undefined,
): TraceDimensionDrillDown | undefined {
  const isSet = value !== undefined;
  const filter = (param: string, filterValue: string, operatorId: TraceFilterOperatorId = 'is') =>
    ({ kind: 'filter', filter: { param, value: filterValue, operatorId } }) as const;
  switch (dimension) {
    case 'entityName':
      return isSet ? filter(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.entityName, value) : undefined;
    case 'environment':
      return isSet
        ? filter(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.environment, value)
        : filter(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.environment, '', 'notExists');
    case 'status':
      return value === 'success' || value === 'error' ? filter(TRACE_STATUS_PARAM, value) : undefined;
    case 'entityType':
      return isSet && ROOT_ENTITY_TYPE_OPTIONS.some(option => option.entityType === value)
        ? filter(TRACE_ROOT_ENTITY_TYPE_PARAM, value)
        : undefined;
    case 'projectId':
      return isSet ? { kind: 'project', projectId: value } : undefined;
  }
}

/**
 * How clicking a group narrows the trace list: one filter per grouped dimension, plus the project to open when
 * grouped by project. Undefined when any of the group's values can't be expressed as a filter.
 */
export type TraceGroupDrillDown = { filters: TraceGroupFilter[]; projectId?: string };

export function getTraceGroupDrillDown(
  groupBy: readonly TraceGroupByDimension[],
  row: TraceGroupRow,
): TraceGroupDrillDown | undefined {
  const drillDown: TraceGroupDrillDown = { filters: [] };
  for (const dimension of groupBy) {
    const entityId = dimension === 'entityName' && !row.dimensions?.entityName ? row.dimensions?.entityId : undefined;
    const step = entityId
      ? ({
          kind: 'filter',
          filter: { param: TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.entityId, value: entityId, operatorId: 'is' },
        } as const)
      : getTraceDimensionDrillDown(dimension, getTraceGroupValue(row, dimension));
    if (!step) return undefined;
    if (step.kind === 'project') drillDown.projectId = step.projectId;
    else drillDown.filters.push(step.filter);
  }
  return drillDown;
}

/** Apply a drill-down's filters: replace those fields' filters with the group's values and leave the grouped view. */
export function applyTraceGroupDrillDown(
  params: URLSearchParams,
  filters: readonly TraceGroupFilter[],
): URLSearchParams {
  const next = new URLSearchParams(params);
  writeTraceGrouping(next, { groupBy: [], having: [] });
  for (const filter of filters) {
    next.set(filter.param, filter.value);
    const operatorParam = traceFilterOperatorParam(filter.param);
    if (filter.operatorId === 'is') next.delete(operatorParam);
    else next.set(operatorParam, filter.operatorId);
  }
  return next;
}

export type TraceGroupCell = { text: string; tooltip?: string };

const MISSING = '—';

/** Display text for one measure of a group, with a tooltip explaining missing or partial values. */
export function formatTraceGroupMeasure(row: TraceGroupRow, measure: TraceGroupByMeasure): TraceGroupCell {
  // Not in this response yet, e.g. a column just added while its request loads.
  if (!(measure in row.measures)) return { text: '…' };
  const value = row.measures[measure] ?? null;
  if (measure.startsWith('cost.')) {
    if (row.cost?.unit === 'mixed') return { text: MISSING, tooltip: 'Costs use more than one currency' };
    if (value === null) return { text: MISSING, tooltip: 'No priced usage for these traces' };
    const text = formatCost(value, row.cost?.unit);
    const coverage = row.cost?.coverage;
    if (coverage != null && coverage < 1) {
      return { text: `~${text}`, tooltip: `Priced for ${formatPercent(coverage)} of traces with usage` };
    }
    return { text };
  }
  if (measure.startsWith('tokens.')) {
    return value === null
      ? { text: MISSING, tooltip: 'No token usage recorded for these traces' }
      : { text: formatCompactNumber(value) };
  }
  if (value === null) return { text: MISSING };
  if (measure === 'errorRate') return { text: formatPercent(value) ?? MISSING };
  if (measure.startsWith('duration.')) return { text: formatDuration(value) ?? MISSING };
  return { text: formatFullNumber(value) };
}
