import {
  KpiCardView,
  formatCompact,
  formatCost,
  useActiveResourcesKpiMetrics,
  useActiveThreadsKpiMetrics,
  useAgentRunsKpiMetrics,
  useModelCostKpiMetrics,
  useTotalTokensKpiMetrics,
} from '@mastra/playground-ui';

export function AgentRunsKpiCard() {
  const { data, isLoading, isError } = useAgentRunsKpiMetrics();
  return (
    <KpiCardView
      label="Total Agent Runs"
      value={data?.value != null ? data.value.toLocaleString() : null}
      prevValue={data?.previousValue != null ? data.previousValue.toLocaleString() : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}

export function ModelCostKpiCard() {
  const { data, isLoading, isError } = useModelCostKpiMetrics();
  return (
    <KpiCardView
      label="Total Model Cost"
      value={data?.cost != null ? formatCost(data.cost, data.costUnit) : null}
      prevValue={data?.previousCost != null ? formatCost(data.previousCost, data.costUnit) : undefined}
      changePct={data?.costChangePercent ?? null}
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
      value={data?.value != null ? formatCompact(data.value) : null}
      prevValue={data?.previousValue != null ? formatCompact(data.previousValue) : undefined}
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
      value={data?.value != null ? formatCompact(data.value) : null}
      prevValue={data?.previousValue != null ? formatCompact(data.previousValue) : undefined}
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
      value={data?.value != null ? formatCompact(data.value) : null}
      prevValue={data?.previousValue != null ? formatCompact(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
