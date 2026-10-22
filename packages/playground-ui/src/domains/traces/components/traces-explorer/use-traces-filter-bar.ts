import type { EntityType } from '@mastra/core/observability';
import { useMastraClient } from '@mastra/react';
import { createTraceQueryValuesResolver, useEntityNames, useEnvironments } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import { isFilterBarGroup } from '../../../../ds/components/FilterBar';
import type { FilterBarExpression, FilterBarField, FilterBarItem } from '../../../../ds/components/FilterBar';
import {
  createTraceFilterBarFields,
  filterBarExpressionToTraceFilters,
  traceFiltersToFilterBarExpression,
  traceTokensToFilterBarItems,
} from '../../trace-filters';
import type { TraceQueryRelatedScope } from '../../trace-query-filters';
import { TRACE_TIME_RANGE_FIELD, TRACE_TIME_RANGE_FIELD_ID, TRACE_TIME_RANGE_ITEM } from '../trace-time-range-chip';
import { getSelectedEntityOption } from './traces-explorer-actions';
import { useTracesConfig, useTracesFilters } from './traces-explorer-context';
import { useTracesDiscovery } from './use-traces-discovery';

const NO_SUGGESTIONS: string[] = [];

/** The fields the trace filter bar offers: time range, trace fields, and discovered metadata. */
export function useTracesFilterBarFields(): FilterBarField[] {
  const { hiddenFieldIds, withQueryTrace, withRootDuration, discoveryTimeRange } = useTracesConfig();
  const { filters } = useTracesFilters();
  const selectedEntityType = getSelectedEntityOption(filters.tokens)?.entityType as EntityType | undefined;

  const { data: rootEntityNames = NO_SUGGESTIONS } = useEntityNames({ entityType: selectedEntityType, rootOnly: true });
  const { data: environments = NO_SUGGESTIONS } = useEnvironments();
  const { fields: metadataFields, canonicalFields } = useTracesDiscovery();
  const client = useMastraClient();

  // Memoized for correctness: static suggestion lists live on the fields and become the value
  // editor's Combobox `items`, which loops if handed a new array on every render.
  return useMemo(
    () => [
      TRACE_TIME_RANGE_FIELD,
      ...createTraceFilterBarFields({
        availableRootEntityNames: rootEntityNames,
        availableEnvironments: environments,
        hiddenFieldIds,
        metadataFields,
        canonicalTraceFields: canonicalFields,
        valueSuggestions: withQueryTrace
          ? (relatedScope: TraceQueryRelatedScope | 'trace', path: string) =>
              createTraceQueryValuesResolver(client, discoveryTimeRange, relatedScope, path)
          : undefined,
        withQueryTrace,
        withRootDuration,
      }),
    ],
    [
      rootEntityNames,
      environments,
      hiddenFieldIds,
      metadataFields,
      canonicalFields,
      withQueryTrace,
      withRootDuration,
      client,
      discoveryTimeRange,
    ],
  );
}

/**
 * The explorer's filters as filter bar values, and the handlers that write bar edits back.
 * Scope items never show up in the bar; the explorer keeps them on every edit.
 */
export function useTracesFilterBar() {
  const { scopedFieldIds } = useTracesConfig();
  const { filters, setFilterTokens } = useTracesFilters();

  const items = traceTokensToFilterBarItems(filters.tokens).filter(item => !scopedFieldIds.has(item.fieldId));
  // The time-range chip is a synthetic, always-present item so it takes part in keyboard
  // navigation; it never round-trips to filter tokens. Expression mode so root-level AND/OR
  // groups render as "Advanced filter" chips.
  const groupsExpression = traceFiltersToFilterBarExpression([], filters.groups);
  const filterBarValue: FilterBarExpression = {
    ...groupsExpression,
    nodes: [TRACE_TIME_RANGE_ITEM, ...items, ...groupsExpression.nodes],
  };
  // Legacy mode: the list endpoint can't express AND/OR groups, so the bar runs flat.
  const flatFilterBarValue = [TRACE_TIME_RANGE_ITEM, ...items];

  const onFilterBarChange = (expression: FilterBarExpression) => {
    const { tokens, groups } = filterBarExpressionToTraceFilters({
      ...expression,
      nodes: expression.nodes.filter(node => isFilterBarGroup(node) || node.fieldId !== TRACE_TIME_RANGE_FIELD_ID),
    });
    setFilterTokens(tokens, groups);
  };

  return {
    filterBarValue,
    flatFilterBarValue,
    onFilterBarChange,
    onFlatFilterBarChange: (nodes: FilterBarItem[]) =>
      onFilterBarChange({ ...traceFiltersToFilterBarExpression([], []), nodes }),
    /** Replaces any filter on `fieldId` with `is value`, e.g. from a list cell. */
    onFilterByField: (fieldId: string, value: string) => {
      const withoutField = items.filter(item => item.fieldId !== fieldId);
      const item: FilterBarItem = { id: `${fieldId}:${value}`, fieldId, operatorId: 'is', value };
      const groups = filterBarValue.nodes.filter(isFilterBarGroup);
      onFilterBarChange({ ...filterBarValue, nodes: [...withoutField, item, ...groups] });
    },
  };
}
