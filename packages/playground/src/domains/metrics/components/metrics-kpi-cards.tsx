import { CompactNumber } from '@mastra/playground-ui/components/CompactNumber';
import { KpiCardView } from '@mastra/playground-ui/domains/metrics/components/kpi-card-view';
import { useActiveResourcesKpiMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-active-resources-kpi-metrics';
import { useActiveThreadsKpiMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-active-threads-kpi-metrics';
import { useAgentRunsKpiMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-agent-runs-kpi-metrics';
import { useModelCostKpiMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-model-cost-kpi-metrics';
import { useTotalTokensKpiMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-total-tokens-kpi-metrics';
import { formatFullNumber } from '@mastra/playground-ui/utils/cost';

export function AgentRunsKpiCard() {
  const { data, isLoading, isError } = useAgentRunsKpiMetrics();
  return (
    <KpiCardView
      label="Total Agent Runs"
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}

export function ModelCostKpiCard() {
  const { data, isLoading, isError } = useModelCostKpiMetrics();
  const currency = data?.costUnit ?? undefined;
  return (
    <KpiCardView
      label="Total Model Cost"
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
  const { data, isLoading, isError } = useTotalTokensKpiMetrics();
  return (
    <KpiCardView
      label="Total Tokens"
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}

export function ActiveThreadsKpiCard() {
  const { data, isLoading, isError } = useActiveThreadsKpiMetrics();
  return (
    <KpiCardView
      label="Total Threads"
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}

export function ActiveResourcesKpiCard() {
  const { data, isLoading, isError } = useActiveResourcesKpiMetrics();
  return (
    <KpiCardView
      label="Total Resources"
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
