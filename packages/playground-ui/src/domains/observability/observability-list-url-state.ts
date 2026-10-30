import { DEFAULT_TRACES_FILTERS } from '@/domains/traces/components/traces-explorer/traces-explorer-actions';
import {
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_PRESET_VALUES,
  TRACE_DATE_TO_PARAM,
  TRACE_FILTER_GROUP_PARAM,
  TRACE_FILTER_OPERATOR_PARAM_SUFFIX,
  getTraceFilterGroups,
  serializeTraceFilterGroup,
  traceFilterOperatorParam,
  traceFilterTokenOperator,
} from '@/domains/traces/trace-filters';
import { isTraceFilterOperatorId } from '@/domains/traces/trace-query-filters';
import type { TraceFilterGroup, TraceFilterToken } from '@/domains/traces/trace-query-filters';
import type { TraceDatePreset } from '@/domains/traces/types';
import { SORT_DIR_PARAM, SORT_KEY_PARAM, readUrlSort } from '@/lib/sort/use-url-sort';

/**
 * URL state of the spans and threads lists. Dates, sort and groups use the same params as /traces;
 * a flat token lives in `filter.<fieldId>` (plus `filter.<fieldId>.op` unless the operator is `is`),
 * since span and thread fields are not in the trace page's fixed `filterX` param map.
 */
export const OBSERVABILITY_LIST_FILTER_PARAM_PREFIX = 'filter.';
export const OBSERVABILITY_LIST_SORT_FIELDS = ['startedAt'] as const;
export const OBSERVABILITY_LIST_DEFAULT_DATE_PRESET: TraceDatePreset = DEFAULT_TRACES_FILTERS.datePreset;

export type ObservabilityListSortDirection = 'asc' | 'desc';
export const OBSERVABILITY_LIST_DEFAULT_SORT_DIRECTION: ObservabilityListSortDirection = 'desc';

export type ObservabilityListDates = { datePreset: TraceDatePreset; dateFrom?: Date; dateTo?: Date };
export type ObservabilityListFilters = { tokens: TraceFilterToken[]; groups: TraceFilterGroup[] };

const filterParam = (fieldId: string) => OBSERVABILITY_LIST_FILTER_PARAM_PREFIX + fieldId;

const isTokenParam = (param: string) =>
  param.startsWith(OBSERVABILITY_LIST_FILTER_PARAM_PREFIX) &&
  param.length > OBSERVABILITY_LIST_FILTER_PARAM_PREFIX.length &&
  !param.endsWith(TRACE_FILTER_OPERATOR_PARAM_SUFFIX);

const isFilterParam = (param: string) => param.startsWith(OBSERVABILITY_LIST_FILTER_PARAM_PREFIX);

function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function readObservabilityListDates(params: URLSearchParams): ObservabilityListDates {
  const preset = params.get(TRACE_DATE_PRESET_PARAM);
  const datePreset =
    preset && TRACE_DATE_PRESET_VALUES.has(preset as TraceDatePreset)
      ? (preset as TraceDatePreset)
      : OBSERVABILITY_LIST_DEFAULT_DATE_PRESET;
  if (datePreset !== 'custom') return { datePreset };
  const dateFrom = parseDate(params.get(TRACE_DATE_FROM_PARAM));
  const dateTo = parseDate(params.get(TRACE_DATE_TO_PARAM));
  return { datePreset, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
}

/** Mutates `params`. The default preset is left out of the URL; dates are only kept for `custom`. */
export function writeObservabilityListDates(
  params: URLSearchParams,
  { datePreset, dateFrom, dateTo }: ObservabilityListDates,
) {
  if (datePreset === OBSERVABILITY_LIST_DEFAULT_DATE_PRESET) params.delete(TRACE_DATE_PRESET_PARAM);
  else params.set(TRACE_DATE_PRESET_PARAM, datePreset);
  const custom = datePreset === 'custom';
  if (custom && dateFrom) params.set(TRACE_DATE_FROM_PARAM, dateFrom.toISOString());
  else params.delete(TRACE_DATE_FROM_PARAM);
  if (custom && dateTo) params.set(TRACE_DATE_TO_PARAM, dateTo.toISOString());
  else params.delete(TRACE_DATE_TO_PARAM);
}

/** Flat tokens in URL order, plus the advanced groups. */
export function readObservabilityListFilters(params: URLSearchParams): ObservabilityListFilters {
  const tokens: TraceFilterToken[] = [];
  const seen = new Set<string>();
  for (const param of params.keys()) {
    if (!isTokenParam(param) || seen.has(param)) continue;
    seen.add(param);
    const fieldId = param.slice(OBSERVABILITY_LIST_FILTER_PARAM_PREFIX.length);
    const rawOperator = params.get(traceFilterOperatorParam(param));
    const operatorId = rawOperator !== null && isTraceFilterOperatorId(rawOperator) ? rawOperator : undefined;
    const values = params.getAll(param);
    if (operatorId === 'in' || operatorId === 'notIn') {
      // An empty entry is the sentinel of a chip with nothing picked yet.
      tokens.push({ fieldId, value: values.filter(Boolean), operatorId });
    } else {
      tokens.push({ fieldId, value: values[0] ?? '', ...(operatorId ? { operatorId } : {}) });
    }
  }
  return { tokens, groups: getTraceFilterGroups(params) };
}

/** Mutates `params`: replaces every filter param with `tokens` (in order) and `groups`. */
export function writeObservabilityListFilters(params: URLSearchParams, { tokens, groups }: ObservabilityListFilters) {
  for (const param of Array.from(params.keys())) {
    if (isFilterParam(param)) params.delete(param);
  }
  params.delete(TRACE_FILTER_GROUP_PARAM);

  for (const token of tokens) {
    const param = filterParam(token.fieldId);
    if (Array.isArray(token.value)) {
      if (token.value.length === 0) params.append(param, '');
      for (const value of token.value) params.append(param, value);
    } else {
      params.set(param, token.value.trim());
    }
    const operatorId = traceFilterTokenOperator(token);
    if (operatorId !== 'is') params.set(traceFilterOperatorParam(param), operatorId);
  }
  for (const group of groups) params.append(TRACE_FILTER_GROUP_PARAM, serializeTraceFilterGroup(group));
}

export function readObservabilityListSort(params: URLSearchParams): ObservabilityListSortDirection {
  return readUrlSort(params, OBSERVABILITY_LIST_SORT_FIELDS)?.direction ?? OBSERVABILITY_LIST_DEFAULT_SORT_DIRECTION;
}

/** Mutates `params`. */
export function writeObservabilityListSort(params: URLSearchParams, direction: ObservabilityListSortDirection) {
  params.set(SORT_KEY_PARAM, OBSERVABILITY_LIST_SORT_FIELDS[0]);
  params.set(SORT_DIR_PARAM, direction);
}
