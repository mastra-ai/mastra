import { useMetricsQueryFilters } from '@mastra/react/hooks/metrics';
import type { OverviewRange } from './overview-period';

const noDimensionalFilter = {};

export function useOverviewWindow(range: OverviewRange) {
  const { timestamp, filterKey } = useMetricsQueryFilters({
    datePreset: range,
    customRange: undefined,
    dimensionalFilter: noDimensionalFilter,
    dimensionalFilterKey: '{}',
  });
  return { window: timestamp, windowKey: filterKey };
}
