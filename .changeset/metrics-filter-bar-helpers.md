---
'@mastra/playground-ui': minor
---

Added helpers to filter the metrics dashboard with `FilterBar`, the filter bar Traces uses.

- `MetricsTimeRangeChip` shows the dashboard's date range as the filter bar's Time chip.
- `createMetricsFilterBarFields` and `METRICS_FILTER_BAR_OPERATORS` describe the dimensions you can filter on.
- `metricsTokensToFilterBarItems` and `filterBarItemsToMetricsTokens` convert between `FilterBar` items and the dashboard's URL-backed filter tokens.

`DateRangeSelector` and `createMetricsPropertyFilterFields` are deprecated in favor of these.

```tsx
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarItem } from '@mastra/playground-ui/components/FilterBar';
import { MetricsTimeRangeChip } from '@mastra/playground-ui/domains/metrics/components/metrics-time-range-chip';
import {
  createMetricsFilterBarFields,
  filterBarItemsToMetricsTokens,
  METRICS_FILTER_BAR_OPERATORS,
  metricsTokensToFilterBarItems,
} from '@mastra/playground-ui/domains/metrics/metrics-filters';
import {
  TRACE_TIME_RANGE_FIELD,
  TRACE_TIME_RANGE_FIELD_ID,
  TRACE_TIME_RANGE_ITEM,
} from '@mastra/playground-ui/domains/traces/components/trace-time-range-chip';

const isTimeRange = (item: FilterBarItem) => item.fieldId === TRACE_TIME_RANGE_FIELD_ID;

<FilterBar
  fields={[TRACE_TIME_RANGE_FIELD, ...createMetricsFilterBarFields(discovered)]}
  operators={METRICS_FILTER_BAR_OPERATORS}
  value={[TRACE_TIME_RANGE_ITEM, ...metricsTokensToFilterBarItems(filterTokens)]}
  onValueChange={items => setFilterTokens(filterBarItemsToMetricsTokens(items.filter(item => !isTimeRange(item))))}
>
  <FilterBar.Chips
    renderChip={item => (isTimeRange(item) ? <MetricsTimeRangeChip /> : <FilterBar.Chip item={item} />)}
  />
  <FilterBar.Input />
</FilterBar>;
```
