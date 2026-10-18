import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem } from '@mastra/playground-ui/components/FilterBar';
import { MetricsTimeRangeChip } from '@mastra/playground-ui/domains/metrics/components/metrics-time-range-chip';
import { useMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import {
  filterBarItemsToMetricsTokens,
  METRICS_FILTER_BAR_OPERATORS,
  metricsTokensToFilterBarItems,
} from '@mastra/playground-ui/domains/metrics/metrics-filters';
import {
  TRACE_TIME_RANGE_FIELD,
  TRACE_TIME_RANGE_FIELD_ID,
  TRACE_TIME_RANGE_ITEM,
} from '@mastra/playground-ui/domains/traces/components/trace-time-range-chip';

const isTimeRangeItem = (item: FilterBarItem) => item.fieldId === TRACE_TIME_RANGE_FIELD_ID;

/** Typeahead filter bar for the metrics dashboard: the time range chip, then one chip per dimension. */
export function MetricsFilterBar({ fields }: { fields: FilterBarField[] }) {
  const { filterTokens, setFilterTokens } = useMetrics();

  // The time range chip is a synthetic, always-present item, as on Traces. Its state lives in the
  // date params, so it never round-trips through the filter tokens.
  const value = [TRACE_TIME_RANGE_ITEM, ...metricsTokensToFilterBarItems(filterTokens)];

  return (
    <FilterBar
      fields={[TRACE_TIME_RANGE_FIELD, ...fields]}
      operators={METRICS_FILTER_BAR_OPERATORS}
      value={value}
      onValueChange={(items: FilterBarItem[]) =>
        setFilterTokens(filterBarItemsToMetricsTokens(items.filter(item => !isTimeRangeItem(item))))
      }
      // Items are rebuilt from URL tokens with `id: fieldId`; keep the draft on the same id so the chip survives.
      createItemId={fieldId => fieldId}
      aria-label="Metrics filters"
      className="min-w-64 flex-1"
    >
      <FilterBar.Chips
        renderChip={item => (isTimeRangeItem(item) ? <MetricsTimeRangeChip /> : <FilterBar.Chip item={item} />)}
      />
      <FilterBar.Input placeholder="Filter metrics…" />
    </FilterBar>
  );
}
