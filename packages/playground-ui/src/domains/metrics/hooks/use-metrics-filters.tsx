import { useMetrics } from './use-metrics';
import type { DatePreset, DateRange } from './use-metrics';

const PRESET_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '14d': 14 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function buildTimestamp(preset: DatePreset, customRange: DateRange | undefined) {
  const now = new Date();
  if (preset !== 'custom') {
    const ms = PRESET_MS[preset] ?? PRESET_MS['24h'];
    return { start: new Date(now.getTime() - ms), end: now };
  }
  return {
    start: customRange?.from ?? new Date(now.getTime() - PRESET_MS['24h']),
    end: customRange?.to ?? now,
  };
}

export function useMetricsFilters() {
  const { datePreset, customRange } = useMetrics();
  const timestamp = buildTimestamp(datePreset, customRange);
  return { datePreset, customRange, timestamp };
}
