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
  entityName: 'Agent / workflow',
  status: 'Status',
  environment: 'Environment',
  entityType: 'Entity type',
  projectId: 'Project',
};

export const TRACE_GROUP_BY_MEASURES = [
  'count',
  'errorRate',
  'duration.p50',
  'duration.p95',
  'tokens.input.sum',
  'tokens.output.sum',
  'cost.sum',
] as const satisfies AggregateTracesArgs['measures'];

export type TraceGroupByMeasure = (typeof TRACE_GROUP_BY_MEASURES)[number];

export const TRACE_GROUP_BY_MEASURE_LABELS: Record<TraceGroupByMeasure, string> = {
  count: 'Traces',
  errorRate: 'Error rate',
  'duration.p50': 'p50 duration',
  'duration.p95': 'p95 duration',
  'tokens.input.sum': 'Input tokens',
  'tokens.output.sum': 'Output tokens',
  'cost.sum': 'Cost',
};

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
    measures: [...TRACE_GROUP_BY_MEASURES],
    ...(comparisons.length === 1 ? { having: comparisons[0] } : {}),
    ...(comparisons.length > 1 ? { having: { op: 'and' as const, args: comparisons } } : {}),
    orderBy: { field: sort.measure, direction: sort.direction },
    limit: TRACE_GROUP_BY_LIMIT,
  };
}

export type TraceGroupRow = AggregateTracesResponse['rows'][number];

/** The group's value for a dimension; undefined when the traces don't set it. */
export const getTraceGroupValue = (row: TraceGroupRow, dimension: TraceGroupByDimension): string | undefined =>
  row.dimensions?.[dimension] || undefined;

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
    const step = getTraceDimensionDrillDown(dimension, getTraceGroupValue(row, dimension));
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
  const value = row.measures[measure] ?? null;
  if (measure === 'cost.sum') {
    if (row.cost?.unit === 'mixed') return { text: MISSING, tooltip: 'Costs use more than one currency' };
    if (value === null) return { text: MISSING, tooltip: 'No priced usage for these traces' };
    const text = formatCost(value, row.cost?.unit);
    const coverage = row.cost?.coverage;
    if (coverage != null && coverage < 1) {
      return { text: `~${text}`, tooltip: `Priced for ${formatPercent(coverage)} of traces with usage` };
    }
    return { text };
  }
  if (value === null) {
    return measure.startsWith('tokens.')
      ? { text: MISSING, tooltip: 'No token usage recorded for these traces' }
      : { text: MISSING };
  }
  switch (measure) {
    case 'count':
      return { text: formatFullNumber(value) };
    case 'tokens.input.sum':
    case 'tokens.output.sum':
      return { text: formatCompactNumber(value) };
    case 'errorRate':
      return { text: formatPercent(value) ?? MISSING };
    case 'duration.p50':
    case 'duration.p95':
      return { text: formatDuration(value) ?? MISSING };
  }
}
