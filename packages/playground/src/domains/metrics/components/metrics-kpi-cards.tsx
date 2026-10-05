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
} from '@mastra/react/hooks/metrics';
import { BotIcon, CoinsIcon, HashIcon, MessagesSquareIcon, UsersIcon } from 'lucide-react';

export function AgentRunsKpiCard() {
  const { data, isLoading, isError } = useAgentRunsKpiMetrics(useMetricsFilters());
  return (
    <KpiCardView
      label="Agent runs"
      icon={<BotIcon />}
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
      icon={<CoinsIcon />}
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
      icon={<HashIcon />}
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
      icon={<MessagesSquareIcon />}
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
      icon={<UsersIcon />}
      value={data?.value != null ? <CompactNumber value={data.value} /> : null}
      prevValue={data?.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
      changePct={data?.changePercent ?? null}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
