import { useEntityNames, useEnvironments } from '@mastra/react/hooks/traces';
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
import { createThreadFilterBarFields } from '../thread-filters';
import { isFilterBarGroup } from '@/ds/components/FilterBar';
import type { FilterBarExpression, FilterBarField, FilterBarItem } from '@/ds/components/FilterBar';

/** The time range presets the threads filter bar offers. */
export const THREAD_TIME_RANGE_PRESETS: readonly TraceDatePreset[] = [
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
];

const NO_SUGGESTIONS: string[] = [];

/** The fields the threads filter bar offers: the time range plus the fields `queryTraceThreads()` accepts. */
export function useThreadsFilterBarFields(): FilterBarField[] {
  const { data: entityNames = NO_SUGGESTIONS } = useEntityNames();
  const { data: environments = NO_SUGGESTIONS } = useEnvironments();

  // Memoized for correctness: static suggestion lists become the value editor's Combobox
  // `items`, which loops if handed a new array on every render.
  return useMemo(
    () => [TRACE_TIME_RANGE_FIELD, ...createThreadFilterBarFields({ entityNames, environments })],
    [entityNames, environments],
  );
}

export type UseThreadsFilterBarOptions = {
  tokens: TraceFilterToken[];
  groups: TraceFilterGroup[];
  onFiltersChange: (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void;
};

/**
 * The thread filters as a filter bar value, and the handlers that write bar edits back.
 * The time-range chip is a synthetic, always-present item; it never round-trips to tokens.
 */
export function useThreadsFilterBar({ tokens, groups, onFiltersChange }: UseThreadsFilterBarOptions): {
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
