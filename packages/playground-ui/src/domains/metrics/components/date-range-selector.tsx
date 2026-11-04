import { useRef } from 'react';
import { DateTimeRangePicker } from '../../../ds/components/DateTimeRangePicker';
import { useMetrics } from '../hooks/use-metrics';
import { fromPickerPreset, METRICS_PICKER_PRESETS, toPickerPreset } from '../metrics-date-presets';

/** @deprecated The metrics dashboard picks its range from the filter bar. Use `MetricsTimeRangeChip`. */
export function DateRangeSelector() {
  const { datePreset, setDatePreset, customRange, setCustomRange } = useMetrics();

  // The picker reports each field separately and also fires onDateChange right
  // after a non-custom preset switch. Track the latest preset and range
  // synchronously so the guard below skips those calls and the second field
  // change still sees the first one.
  const presetRef = useRef(datePreset);
  presetRef.current = datePreset;
  const customRangeRef = useRef(customRange);
  customRangeRef.current = customRange;

  return (
    <DateTimeRangePicker
      preset={toPickerPreset(datePreset)}
      onPresetChange={next => {
        const mapped = fromPickerPreset(next);
        presetRef.current = mapped;
        setDatePreset(mapped);
      }}
      dateFrom={customRange?.from}
      dateTo={customRange?.to}
      onDateChange={(value, type) => {
        if (presetRef.current !== 'custom') return;
        const next = { ...customRangeRef.current, [type]: value };
        customRangeRef.current = next;
        setCustomRange(next);
      }}
      presets={METRICS_PICKER_PRESETS}
    />
  );
}
