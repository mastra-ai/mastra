---
'@mastra/playground-ui': minor
---

Filter bar time ranges now use the same calendar control as the standalone date range picker: a calendar icon, the range, and a chevron, with no separate "Time" label. The standalone `DateTimeRangePicker` trigger also gains the chevron.

Added `FilterBar.TimeRange` with `FILTER_BAR_TIME_RANGE_FIELD`, `FILTER_BAR_TIME_RANGE_ITEM` and `FILTER_BAR_TIME_RANGE_FIELD_ID`. The trace-specific names are deprecated aliases and keep working. `DateTimeRangePicker`'s `renderTrigger` now also receives the trigger's `icon` and `iconEnd`, so a custom trigger shows the same calendar control.

```tsx
// Before
import {
  TraceTimeRangeChip,
  TRACE_TIME_RANGE_FIELD,
  TRACE_TIME_RANGE_ITEM,
} from '@mastra/playground-ui/domains/traces/components/trace-time-range-chip';

// After
import {
  FilterBar,
  FILTER_BAR_TIME_RANGE_FIELD,
  FILTER_BAR_TIME_RANGE_ITEM,
} from '@mastra/playground-ui/components/FilterBar';

<FilterBar.TimeRange preset={preset} onPresetChange={setPreset} />;
```
