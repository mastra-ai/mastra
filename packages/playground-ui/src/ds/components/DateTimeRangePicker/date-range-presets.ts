export type DateRangePreset = 'all' | 'last-24h' | 'last-3d' | 'last-7d' | 'last-14d' | 'last-30d' | 'custom';

export const DATE_PRESETS: { value: DateRangePreset; label: string; ms?: number }[] = [
  { value: 'all', label: 'All' },
  { value: 'last-24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: 'last-3d', label: 'Last 3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { value: 'last-7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'last-14d', label: 'Last 14 days', ms: 14 * 24 * 60 * 60 * 1000 },
  { value: 'last-30d', label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'custom', label: 'Custom range...' },
];

/** The picker's label for a preset, e.g. `Last 24 hours`. */
export const dateRangePresetLabel = (preset: string): string | undefined =>
  DATE_PRESETS.find(candidate => candidate.value === preset)?.label;
