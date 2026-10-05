import { CompactNumber } from '@mastra/playground-ui/components/CompactNumber';
import { KpiCardView } from '@mastra/playground-ui/domains/metrics/components/kpi-card-view';
import { useMetricsFilters } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics-filters';
import { formatFullNumber } from '@mastra/playground-ui/utils/cost';
import {
  useActiveResourcesKpiMetrics,
  useActiveThreadsKpiMetrics,
  useAgentRunsKpiMetrics,
  useModelCostKpiMetrics,
  useTotalTokensKpiMetrics,
} from '@mastra/react/hooks';

export function AgentRunsKpiCard() {
  const { data, isLoading, isError } = useAgentRunsKpiMetrics(useMetricsFilters());
  return (
    <KpiCardView
      label="Agent runs"
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}

export function ModelCostKpiCard() {
  const { data, isLoading, isError } = useModelCostKpiMetrics(useMetricsFilters());
  const currency = data?.costUnit ?? undefined;
  return (
    <KpiCardView
      label="Model cost"
      value={data?.cost != null ? <CompactNumber value={data.cost} currency={currency} /> : null}
      prevValue={data?.previousCost != null ? formatFullNumber(data.previousCost, { currency }) : undefined}
      changePct={data?.costChangePercent ?? null}
      lowerIsBetter
      isLoading={isLoading}
      isError={isError}
    />
  );
}

export function TotalTokensKpiCard() {
  const { data, isLoading, isError } = useTotalTokensKpiMetrics(useMetricsFilters());
  return (
    <KpiCardView
      label="Tokens"
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}

export function ActiveThreadsKpiCard() {
  const { data, isLoading, isError } = useActiveThreadsKpiMetrics(useMetricsFilters());
  return (
    <KpiCardView
      label="Threads"
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}

export function ActiveResourcesKpiCard() {
  const { data, isLoading, isError } = useActiveResourcesKpiMetrics(useMetricsFilters());
  return (
    <KpiCardView
      label="Resources"
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
