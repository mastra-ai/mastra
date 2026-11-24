import { useMemo } from 'react';
import {
  createTraceFilterBarFields,
  filterBarExpressionToTraceFilters,
  traceFiltersToFilterBarExpression,
  traceTokensToFilterBarItems,
} from '../../trace-filters';
import { useTracesConfig, useTracesFilters } from './traces-explorer-context';
import type { TracesExplorerFilterSuggestions } from './traces-explorer-data';
import { withTokenSearchFields } from '@/domains/observability/lib/token-search-predicate';
import { isFilterBarGroup } from '@/ds/components/FilterBar';
import type { FilterBarExpression, FilterBarField, FilterBarItem } from '@/ds/components/FilterBar';
import {
  FILTER_BAR_TIME_RANGE_FIELD,
  FILTER_BAR_TIME_RANGE_FIELD_ID,
  FILTER_BAR_TIME_RANGE_ITEM,
} from '@/ds/components/FilterBar/filter-bar-time-range';

/**
 * The fields the trace filter bar offers: time range, trace fields, and discovered metadata. The
 * suggestions come from the host (Studio: `useTracesFilterSuggestionsQuery`). A list the host leaves
 * out makes its field take free text (`Primitive name`, `Environment`); without `resolveValues`, the
 * span, score and feedback fields take free text too.
 */
export function useTracesFilterBarFields({
  rootEntityNames,
  environments,
  resolveValues,
}: TracesExplorerFilterSuggestions = {}): FilterBarField[] {
  const {
    hiddenFieldIds,
    withTokenSearch,
    withQueryTrace,
    withRootDuration,
    withTimeToFirstChunk,
    withTimeToFirstToken,
    withOutcomeFields,
    discovery: { fields: metadataFields, canonicalFields },
  } = useTracesConfig();

  // Memoized for correctness: static suggestion lists live on the fields and become the value
  // editor's Combobox `items`, which loops if handed a new array on every render.
  return useMemo(
    () => [
      FILTER_BAR_TIME_RANGE_FIELD,
      ...withTokenSearchFields(
        createTraceFilterBarFields({
          availableRootEntityNames: rootEntityNames,
          availableEnvironments: environments,
          hiddenFieldIds,
          metadataFields,
          canonicalTraceFields: canonicalFields,
          valueSuggestions: withQueryTrace ? resolveValues : undefined,
          withQueryTrace,
          withRootDuration,
          withTimeToFirstChunk,
          withTimeToFirstToken,
          withOutcomeFields,
        }),
        withTokenSearch,
        'spans.',
      ),
    ],
    [
      rootEntityNames,
      environments,
      hiddenFieldIds,
      metadataFields,
      canonicalFields,
      withTokenSearch,
      withQueryTrace,
      withRootDuration,
      withTimeToFirstChunk,
      withTimeToFirstToken,
      withOutcomeFields,
      resolveValues,
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
  // The time range is a synthetic, always-present item so it takes part in keyboard
  // navigation; it never round-trips to filter tokens. Expression mode so root-level AND/OR
  // groups render as "Advanced filter" chips.
  const groupsExpression = traceFiltersToFilterBarExpression([], filters.groups);
  const filterBarValue: FilterBarExpression = {
    ...groupsExpression,
    nodes: [FILTER_BAR_TIME_RANGE_ITEM, ...items, ...groupsExpression.nodes],
  };
  // Legacy mode: the list endpoint can't express AND/OR groups, so the bar runs flat.
  const flatFilterBarValue = [FILTER_BAR_TIME_RANGE_ITEM, ...items];

  const onFilterBarChange = (expression: FilterBarExpression) => {
    const { tokens, groups } = filterBarExpressionToTraceFilters({
      ...expression,
      nodes: expression.nodes.filter(node => isFilterBarGroup(node) || node.fieldId !== FILTER_BAR_TIME_RANGE_FIELD_ID),
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
