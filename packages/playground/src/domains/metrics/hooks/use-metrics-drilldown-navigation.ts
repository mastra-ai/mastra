import { buildLogsDrilldownUrl, buildTracesDrilldownUrl } from '@mastra/playground-ui/domains/metrics/drilldown';
import type { DrilldownScope } from '@mastra/playground-ui/domains/metrics/drilldown';
import { useMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import { useContext } from 'react';
import { useNavigate } from 'react-router';
import { MetricsAgentScopeContext } from '../context/metrics-agent-scope';

/** Opens the Studio traces or logs page, keeping the dashboard's date range and filters. */
export function useMetricsDrilldownNavigation() {
  const { datePreset, customRange, dimensionalFilter } = useMetrics();
  const agentScope = useContext(MetricsAgentScopeContext);
  const navigate = useNavigate();
  const base = { preset: datePreset, customRange, dashboardFilter: dimensionalFilter };

  const openTraces = (scope: DrilldownScope = {}) => {
    const url = buildTracesDrilldownUrl({ ...base, scope });
    void navigate(agentScope ? url.replace('/traces', `/agents/${encodeURIComponent(agentScope.id)}/traces`) : url);
  };

  const openLogs = (scope: DrilldownScope = {}) => {
    void navigate(buildLogsDrilldownUrl({ ...base, scope }));
  };

  return { openTraces, openLogs };
}
