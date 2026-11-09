import { buildLogsDrilldownUrl, buildTracesDrilldownUrl } from '@mastra/playground-ui/domains/metrics/drilldown';
import type { DrilldownScope } from '@mastra/playground-ui/domains/metrics/drilldown';
import { useMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import { useNavigate } from 'react-router';

/** Opens the Studio traces or logs page, keeping the dashboard's date range and filters. */
export function useMetricsDrilldownNavigation() {
  const { datePreset, customRange, dimensionalFilter } = useMetrics();
  const navigate = useNavigate();
  const base = { preset: datePreset, customRange, dashboardFilter: dimensionalFilter };

  const openTraces = (scope: DrilldownScope = {}) => {
    void navigate(buildTracesDrilldownUrl({ ...base, scope }));
  };

  const openLogs = (scope: DrilldownScope = {}) => {
    void navigate(buildLogsDrilldownUrl({ ...base, scope }));
  };

  return { openTraces, openLogs };
}
