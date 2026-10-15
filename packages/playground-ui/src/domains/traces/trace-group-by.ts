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
  TRACE_GROUP_SORT_PARAM,
  TRACE_PROPERTY_FILTER_PARAM_BY_FIELD,
  TRACE_ROOT_ENTITY_TYPE_PARAM,
  TRACE_STATUS_PARAM,
  traceFilterOperatorParam,
} from './trace-filters';
import { formatCompactNumber, formatCost, formatFullNumber } from '@/lib/cost';
import { formatPercent } from '@/lib/number';
import { formatDuration } from '@/utils/duration';

export { TRACE_GROUP_BY_PARAM, TRACE_GROUP_SORT_PARAM };

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

export function parseTraceGroupBy(
  params: URLSearchParams,
  offered: readonly TraceGroupByDimension[],
): TraceGroupByDimension | undefined {
  const value = params.get(TRACE_GROUP_BY_PARAM);
  return offered.find(dimension => dimension === value);
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
  dimension: TraceGroupByDimension,
  sort: TraceGroupSort,
): AggregateTracesArgs {
  return {
    timeRange: query.timeRange,
    ...(query.where ? { where: query.where } : {}),
    groupBy: [dimension],
    measures: [...TRACE_GROUP_BY_MEASURES],
    orderBy: { field: sort.measure, direction: sort.direction },
    limit: TRACE_GROUP_BY_LIMIT,
  };
}

export type TraceGroupRow = AggregateTracesResponse['rows'][number];

export const getTraceGroupValue = (row: TraceGroupRow, dimension: TraceGroupByDimension): string | null =>
  row.dimensions?.[dimension] ?? null;

const STATUS_LABELS: Record<string, string> = { success: 'Success', error: 'Error' };

export function formatTraceGroupValue(dimension: TraceGroupByDimension, value: string | null): string {
  if (value === null || value === '') return TRACE_GROUP_NOT_SET_LABEL;
  if (dimension === 'status') return STATUS_LABELS[value] ?? value;
  if (dimension === 'entityType') {
    return ROOT_ENTITY_TYPE_OPTIONS.find(option => option.entityType === value)?.label ?? value;
  }
  return value;
}

export type TraceGroupDrillDown =
  | { kind: 'filter'; param: string; value: string; operatorId: TraceFilterOperatorId }
  | { kind: 'project'; projectId: string };

/** How clicking a group narrows the trace list, or undefined when the list's filters can't express the group. */
export function getTraceGroupDrillDown(
  dimension: TraceGroupByDimension,
  value: string | null,
): TraceGroupDrillDown | undefined {
  const isSet = value !== null && value !== '';
  switch (dimension) {
    case 'entityName':
      return isSet
        ? { kind: 'filter', param: TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.entityName, value, operatorId: 'is' }
        : undefined;
    case 'environment':
      return isSet
        ? { kind: 'filter', param: TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.environment, value, operatorId: 'is' }
        : {
            kind: 'filter',
            param: TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.environment,
            value: '',
            operatorId: 'notExists',
          };
    case 'status':
      return value === 'success' || value === 'error'
        ? { kind: 'filter', param: TRACE_STATUS_PARAM, value, operatorId: 'is' }
        : undefined;
    case 'entityType':
      return isSet && ROOT_ENTITY_TYPE_OPTIONS.some(option => option.entityType === value)
        ? { kind: 'filter', param: TRACE_ROOT_ENTITY_TYPE_PARAM, value, operatorId: 'is' }
        : undefined;
    case 'projectId':
      return isSet ? { kind: 'project', projectId: value } : undefined;
  }
}

/** Apply a filter drill-down: replace that field's filter with the group's value and leave the grouped view. */
export function applyTraceGroupDrillDown(
  params: URLSearchParams,
  drillDown: Extract<TraceGroupDrillDown, { kind: 'filter' }>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(TRACE_GROUP_BY_PARAM);
  next.set(drillDown.param, drillDown.value);
  const operatorParam = traceFilterOperatorParam(drillDown.param);
  if (drillDown.operatorId === 'is') next.delete(operatorParam);
  else next.set(operatorParam, drillDown.operatorId);
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
