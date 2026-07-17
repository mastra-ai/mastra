import { useRef } from 'react';
import { DateTimeRangePicker } from '../../../ds/components/DateTimeRangePicker';
import type { DateRangePreset } from '../../../ds/components/DateTimeRangePicker';
import { useMetrics } from '../hooks/use-metrics';
import type { DatePreset } from '../hooks/use-metrics';

const METRICS_PRESETS: readonly DateRangePreset[] = [
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
];

function toPickerPreset(preset: DatePreset): DateRangePreset {
  switch (preset) {
    case '3d':
      return 'last-3d';
    case '7d':
      return 'last-7d';
    case '14d':
      return 'last-14d';
    case '30d':
      return 'last-30d';
    case 'custom':
      return 'custom';
    default:
      return 'last-24h';
  }
}

function fromPickerPreset(preset: DateRangePreset): DatePreset {
  switch (preset) {
    case 'last-3d':
      return '3d';
    case 'last-7d':
      return '7d';
    case 'last-14d':
      return '14d';
    case 'last-30d':
      return '30d';
    case 'custom':
      return 'custom';
    default:
      return '24h';
  }
}

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
      presets={METRICS_PRESETS}
    />
  );
}
