import {
  useActiveThreadsKpiMetrics,
  useAgentRunsKpiMetrics,
  useModelCostKpiMetrics,
  useTotalTokensKpiMetrics,
} from '@mastra/react/hooks/metrics';
import { keepPreviousData } from '@tanstack/react-query';
import { BotIcon, CoinsIcon, HashIcon, MessagesSquareIcon } from 'lucide-react';
import { useMetrics } from '../hooks/use-metrics';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { formatCount, formatUsd } from '../lib/chart-format';
import { KpiCard } from './kpi-card';
import { MetricsCardGroup } from '@/ds/components/MetricsCardGroup';

const KEEP = { placeholderData: keepPreviousData };

// The API sends `null` for "no value": shown as a dash, or no change at all.
const count = (value: number | null | undefined) => (value == null ? '—' : formatCount(value));
const usd = (value: number | null | undefined) => (value == null ? '—' : formatUsd(value));
const change = (pct: number | null | undefined) => (pct == null || !Number.isFinite(pct) ? undefined : pct);
const previousCount = (value: number | null | undefined) => (value == null ? undefined : formatCount(value));
const previousUsd = (value: number | null | undefined) => (value == null ? undefined : formatUsd(value));

/** Agent runs, model cost, tokens and threads for the range, each against the previous range. */
export function MetricsKpis() {
  return (
    <MetricsCardGroup>
      <AgentRunsKpi />
      <ModelCostKpi />
      <TokensKpi />
      <ThreadsKpi />
    </MetricsCardGroup>
  );
}

function AgentRunsKpi() {
  const { comparisonLabel } = useMetrics();
  const { data, isLoading, isPlaceholderData, isError } = useAgentRunsKpiMetrics({
    ...useMetricsFilters(),
    queryOptions: KEEP,
  });
  return (
    <KpiCard
      label="Agent runs"
      icon={BotIcon}
      value={count(data?.value)}
      change={change(data?.changePercent)}
      detail="in this range"
      previous={previousCount(data?.previousValue)}
      comparison={comparisonLabel}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

function ModelCostKpi() {
  const { comparisonLabel } = useMetrics();
  const { data, isLoading, isPlaceholderData, isError } = useModelCostKpiMetrics({
    ...useMetricsFilters(),
    queryOptions: KEEP,
  });
  return (
    <KpiCard
      label="Model cost"
      icon={CoinsIcon}
      value={usd(data?.cost)}
      change={change(data?.costChangePercent)}
      lowerIsBetter
      detail="estimated"
      previous={previousUsd(data?.previousCost)}
      comparison={comparisonLabel}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

function TokensKpi() {
  const { comparisonLabel } = useMetrics();
  const { data, isLoading, isPlaceholderData, isError } = useTotalTokensKpiMetrics({
    ...useMetricsFilters(),
    queryOptions: KEEP,
  });
  return (
    <KpiCard
      label="Tokens"
      icon={HashIcon}
      value={count(data?.value)}
      change={change(data?.changePercent)}
      detail="input and output"
      previous={previousCount(data?.previousValue)}
      comparison={comparisonLabel}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

function ThreadsKpi() {
  const { comparisonLabel } = useMetrics();
  const { data, isLoading, isPlaceholderData, isError } = useActiveThreadsKpiMetrics({
    ...useMetricsFilters(),
    queryOptions: KEEP,
  });
  return (
    <KpiCard
      label="Threads"
      icon={MessagesSquareIcon}
      value={count(data?.value)}
      change={change(data?.changePercent)}
      detail="with agent runs"
      previous={previousCount(data?.previousValue)}
      comparison={comparisonLabel}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}
