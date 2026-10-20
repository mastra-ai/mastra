import type { AggregateTracesArgs, AggregateTracesResponse } from '@mastra/client-js';
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
import { useMetricsTraceAggregate, useTraceAggregateGate } from '../hooks/use-metrics-trace-aggregate';
import type { TraceAggregateScope } from '../hooks/use-metrics-trace-aggregate';
import { formatCount, formatUsd } from '../lib/chart-format';
import { toTraceAggregateTimeRange } from '../lib/trace-aggregate';
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

/** Tokens come from `aggregateTraces()` when the server has it, else from the token metrics. */
function TokensKpi() {
  const gate = useTraceAggregateGate();
  if (gate.status === 'loading') return <TokensKpiCard isLoading />;
  if (gate.status === 'ready') return <TraceTokensKpi scope={gate.scope} />;
  return <MetricTokensKpi />;
}

const TOKEN_MEASURES: AggregateTracesArgs['measures'] = ['tokens.input.sum', 'tokens.output.sum'];

/** Input plus output tokens of one window's traces; `null` when no trace reported usage. */
function tokenTotal(response: AggregateTracesResponse | undefined): number | null | undefined {
  if (!response) return undefined;
  const measures = response.rows[0]?.measures;
  const input = measures?.['tokens.input.sum'];
  const output = measures?.['tokens.output.sum'];
  if (input == null && output == null) return null;
  return (input ?? 0) + (output ?? 0);
}

function TraceTokensKpi({ scope }: { scope: TraceAggregateScope }) {
  const { start, end } = scope.window;
  const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
  const current = useMetricsTraceAggregate({
    timeRange: scope.timeRange,
    where: scope.where,
    measures: TOKEN_MEASURES,
  });
  const previous = useMetricsTraceAggregate({
    timeRange: toTraceAggregateTimeRange({ start: previousStart, end: start }),
    where: scope.where,
    measures: TOKEN_MEASURES,
  });
  const value = tokenTotal(current.data);
  const previousValue = tokenTotal(previous.data);
  return (
    <TokensKpiCard
      value={value}
      previousValue={previousValue}
      changePercent={value != null && previousValue ? ((value - previousValue) / previousValue) * 100 : undefined}
      isLoading={current.isLoading}
      isUpdating={current.isPlaceholderData}
      isError={current.isError}
    />
  );
}

function MetricTokensKpi() {
  const { data, isLoading, isPlaceholderData, isError } = useTotalTokensKpiMetrics({
    ...useMetricsFilters(),
    queryOptions: KEEP,
  });
  return (
    <TokensKpiCard
      value={data?.value}
      previousValue={data?.previousValue}
      changePercent={data?.changePercent}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

type TokensKpiCardProps = {
  value?: number | null;
  previousValue?: number | null;
  changePercent?: number | null;
  isLoading?: boolean;
  isUpdating?: boolean;
  isError?: boolean;
};

function TokensKpiCard({ value, previousValue, changePercent, ...state }: TokensKpiCardProps) {
  const { comparisonLabel } = useMetrics();
  return (
    <KpiCard
      label="Tokens"
      icon={HashIcon}
      value={count(value)}
      change={change(changePercent)}
      detail="input and output"
      previous={previousCount(previousValue)}
      comparison={comparisonLabel}
      {...state}
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
