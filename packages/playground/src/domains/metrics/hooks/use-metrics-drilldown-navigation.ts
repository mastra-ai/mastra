import { buildLogsDrilldownUrl, buildTracesDrilldownUrl } from '@mastra/playground-ui/domains/metrics/drilldown';
import type { DrilldownScope } from '@mastra/playground-ui/domains/metrics/drilldown';
import { useMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import { useNavigate } from 'react-router';

/** Turns card drilldown scopes into navigations to the Studio traces and logs pages. */
export function useMetricsDrilldownNavigation() {
  const { datePreset, customRange, dimensionalFilter } = useMetrics();
  const navigate = useNavigate();

  const openTraces = (scope: DrilldownScope) => {
    void navigate(
      buildTracesDrilldownUrl({ preset: datePreset, customRange, dashboardFilter: dimensionalFilter, scope }),
    );
  };

  const openLogs = (scope: DrilldownScope) => {
    void navigate(
      buildLogsDrilldownUrl({ preset: datePreset, customRange, dashboardFilter: dimensionalFilter, scope }),
    );
  };

  return { openTraces, openLogs };
}
