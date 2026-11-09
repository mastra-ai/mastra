import type { DatePreset } from './hooks/use-metrics';
import type { DateRangePreset } from '@/ds/components/DateTimeRangePicker';

/** The date presets the metrics dashboard offers, in `DateTimeRangePicker` terms. */
export const METRICS_PICKER_PRESETS: readonly DateRangePreset[] = [
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
];

export function toPickerPreset(preset: DatePreset): DateRangePreset {
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

export function fromPickerPreset(preset: DateRangePreset): DatePreset {
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
