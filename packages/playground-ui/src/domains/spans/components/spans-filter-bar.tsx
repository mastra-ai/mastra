import { useMastraClient } from '@mastra/react';
import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { createTraceQueryValuesResolver, useEntityNames, useEnvironments } from '@mastra/react/hooks/traces';
import type { TraceQueryDiscoveryTimeRange } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import { FilterBar, isFilterBarGroup } from '../../../ds/components/FilterBar';
import type { FilterBarExpression } from '../../../ds/components/FilterBar';
import {
  TraceTimeRangeChip,
  TRACE_TIME_RANGE_FIELD,
  TRACE_TIME_RANGE_FIELD_ID,
  TRACE_TIME_RANGE_ITEM,
} from '../../traces/components/trace-time-range-chip';
import {
  filterBarExpressionToTraceFilters,
  TRACE_FILTER_BAR_OPERATORS,
  traceFiltersToFilterBarExpression,
  traceTokensToFilterBarItems,
} from '../../traces/trace-filters';
import type { TraceFilterGroup, TraceFilterToken } from '../../traces/trace-query-filters';
import type { TraceDatePreset } from '../../traces/types';
import { createSpanFilterBarFields } from '../span-filters';

const TIME_RANGE_PRESETS: readonly TraceDatePreset[] = [
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
];

const NO_SUGGESTIONS: string[] = [];

// Items are rebuilt from tokens with `id: fieldId` (traceTokensToFilterBarItems); give the
// draft that id so the chip survives the round trip without remounting.
const createItemId = (fieldId: string) => fieldId;

export type SpansFilterBarProps = {
  datePreset: TraceDatePreset;
  dateFrom?: Date;
  dateTo?: Date;
  /** Window the value suggestions are looked up in. */
  timeRange: TraceQueryDiscoveryTimeRange;
  tokens: TraceFilterToken[];
  groups: TraceFilterGroup[];
  onDatePresetChange: (preset: TraceDatePreset) => void;
  onDateChange: (value: Date | undefined, type: 'from' | 'to') => void;
  onDateRangeChange: (from: Date | undefined, to: Date | undefined) => void;
  onFiltersChange: (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void;
  disabled?: boolean;
};

/** The spans filter bar: a time range chip plus the fields `querySpans()` accepts. */
export function SpansFilterBar({
  datePreset,
  dateFrom,
  dateTo,
  timeRange,
  tokens,
  groups,
  onDatePresetChange,
  onDateChange,
  onDateRangeChange,
  onFiltersChange,
  disabled,
}: SpansFilterBarProps) {
  const client = useMastraClient();
  const { data: capabilities } = useObservabilityCapabilities();
  const withContextFields = capabilities?.capabilities.spanQueryContextFields ?? false;
  const { data: entityNames = NO_SUGGESTIONS } = useEntityNames();
  const { data: environments = NO_SUGGESTIONS } = useEnvironments();

  // Memoized for correctness: static suggestion lists become the value editor's Combobox
  // `items`, which loops if handed a new array on every render.
  const fields = useMemo(
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

  // The time-range chip is a synthetic, always-present item; it never round-trips to tokens.
  const groupsExpression = traceFiltersToFilterBarExpression([], groups);
  const value: FilterBarExpression = {
    ...groupsExpression,
    nodes: [TRACE_TIME_RANGE_ITEM, ...traceTokensToFilterBarItems(tokens), ...groupsExpression.nodes],
  };

  const handleValueChange = (expression: FilterBarExpression) => {
    const next = filterBarExpressionToTraceFilters({
      ...expression,
      nodes: expression.nodes.filter(node => isFilterBarGroup(node) || node.fieldId !== TRACE_TIME_RANGE_FIELD_ID),
    });
    onFiltersChange(next.tokens, next.groups);
  };

  return (
    <FilterBar
      fields={fields}
      operators={TRACE_FILTER_BAR_OPERATORS}
      value={value}
      onValueChange={handleValueChange}
      createItemId={createItemId}
      maxDepth={3}
      aria-label="Span filters"
      className="min-w-64 flex-1"
    >
      <FilterBar.Chips
        renderChip={item =>
          item.fieldId === TRACE_TIME_RANGE_FIELD_ID ? (
            <TraceTimeRangeChip
              preset={datePreset}
              onPresetChange={onDatePresetChange}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={onDateChange}
              onDateRangeChange={onDateRangeChange}
              disabled={disabled}
              presets={TIME_RANGE_PRESETS}
            />
          ) : (
            <FilterBar.Chip item={item} />
          )
        }
      />
      <FilterBar.Input placeholder="Filter spans…" />
    </FilterBar>
  );
}
