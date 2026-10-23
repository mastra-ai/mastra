import { useMastraClient } from '@mastra/react';
import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { createTraceQueryValuesResolver, useEntityNames, useEnvironments } from '@mastra/react/hooks/traces';
import type { TraceQueryDiscoveryTimeRange } from '@mastra/react/hooks/traces';
import { useCallback, useMemo } from 'react';
import {
  TRACE_TIME_RANGE_FIELD,
  TRACE_TIME_RANGE_FIELD_ID,
  TRACE_TIME_RANGE_ITEM,
} from '../../traces/components/trace-time-range-chip';
import {
  filterBarExpressionToTraceFilters,
  traceFiltersToFilterBarExpression,
  traceTokensToFilterBarItems,
} from '../../traces/trace-filters';
import type { TraceFilterGroup, TraceFilterToken } from '../../traces/trace-query-filters';
import type { TraceDatePreset } from '../../traces/types';
import { createSpanFilterBarFields } from '../span-filters';
import { isFilterBarGroup } from '@/ds/components/FilterBar';
import type { FilterBarExpression, FilterBarField, FilterBarItem } from '@/ds/components/FilterBar';

/** The time range presets the spans filter bar offers. */
export const SPAN_TIME_RANGE_PRESETS: readonly TraceDatePreset[] = [
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
];

const NO_SUGGESTIONS: string[] = [];

export type UseSpansFilterBarFieldsOptions = {
  /** Window the value suggestions are looked up in. */
  timeRange: TraceQueryDiscoveryTimeRange;
};

/**
 * The fields the spans filter bar offers: the time range plus the fields `querySpans()` accepts.
 * Context fields are only included when the store declares `spanQueryContextFields`.
 */
export function useSpansFilterBarFields({ timeRange }: UseSpansFilterBarFieldsOptions): FilterBarField[] {
  const client = useMastraClient();
  const { data: capabilities } = useObservabilityCapabilities();
  const withContextFields = capabilities?.capabilities.spanQueryContextFields ?? false;
  const { data: entityNames = NO_SUGGESTIONS } = useEntityNames();
  const { data: environments = NO_SUGGESTIONS } = useEnvironments();

  // Memoized for correctness: static suggestion lists become the value editor's Combobox
  // `items`, which loops if handed a new array on every render.
  return useMemo(
    () => [
      TRACE_TIME_RANGE_FIELD,
      ...createSpanFilterBarFields({
        withContextFields,
        entityNames,
        environments,
        valueSuggestions: path => createTraceQueryValuesResolver(client, timeRange, 'spans', path),
      }),
    ],
    [withContextFields, entityNames, environments, client, timeRange],
  );
}

export type UseSpansFilterBarOptions = {
  tokens: TraceFilterToken[];
  groups: TraceFilterGroup[];
  onFiltersChange: (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void;
};

/**
 * The span filters as a filter bar value, and the handlers that write bar edits back.
 * The time-range chip is a synthetic, always-present item; it never round-trips to tokens.
 */
export function useSpansFilterBar({ tokens, groups, onFiltersChange }: UseSpansFilterBarOptions): {
  filterBarValue: FilterBarExpression;
  onFilterBarChange: (expression: FilterBarExpression) => void;
  /** Replaces any filter on `fieldId` with `is value`, e.g. from a list cell. */
  onFilterByField: (fieldId: string, value: string) => void;
} {
  const items = useMemo(() => traceTokensToFilterBarItems(tokens), [tokens]);

  const filterBarValue = useMemo<FilterBarExpression>(() => {
    const groupsExpression = traceFiltersToFilterBarExpression([], groups);
    return { ...groupsExpression, nodes: [TRACE_TIME_RANGE_ITEM, ...items, ...groupsExpression.nodes] };
  }, [items, groups]);

  const onFilterBarChange = useCallback(
    (expression: FilterBarExpression) => {
      const next = filterBarExpressionToTraceFilters({
        ...expression,
        nodes: expression.nodes.filter(node => isFilterBarGroup(node) || node.fieldId !== TRACE_TIME_RANGE_FIELD_ID),
      });
      onFiltersChange(next.tokens, next.groups);
    },
    [onFiltersChange],
  );

  const onFilterByField = useCallback(
    (fieldId: string, value: string) => {
      const withoutField = items.filter(item => item.fieldId !== fieldId);
      const item: FilterBarItem = { id: `${fieldId}:${value}`, fieldId, operatorId: 'is', value };
      const groupNodes = filterBarValue.nodes.filter(isFilterBarGroup);
      onFilterBarChange({ ...filterBarValue, nodes: [...withoutField, item, ...groupNodes] });
    },
    [items, filterBarValue, onFilterBarChange],
  );

  return { filterBarValue, onFilterBarChange, onFilterByField };
}
