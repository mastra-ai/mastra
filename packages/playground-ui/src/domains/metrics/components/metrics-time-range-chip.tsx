import { useMetrics } from '../hooks/use-metrics';
import { useTraceRetentionMinDate } from '../hooks/use-trace-retention-min-date';
import { fromPickerPreset, METRICS_PICKER_PRESETS, toPickerPreset } from '../metrics-date-presets';
import { FilterBarTimeRange } from '@/ds/components/FilterBar';

/**
 * The dashboard's date range as the filter bar's time range, the same control the Traces page shows.
 * Render it from `FilterBar.Chips` for `FILTER_BAR_TIME_RANGE_ITEM`, inside a `MetricsProvider`.
 */
export function MetricsTimeRangeChip() {
  const { datePreset, setDatePreset, customRange, setCustomRange } = useMetrics();
  const minDate = useTraceRetentionMinDate();

  return (
    <FilterBarTimeRange
      preset={toPickerPreset(datePreset)}
      onPresetChange={next => setDatePreset(fromPickerPreset(next))}
      dateFrom={customRange?.from}
      dateTo={customRange?.to}
      // Relative presets derive their window from the preset alone; only an applied custom range
      // carries bounds, and both land in one update.
      onDateRangeChange={(from, to) => setCustomRange({ from, to })}
      presets={METRICS_PICKER_PRESETS}
      minDate={minDate}
    />
  );
}
