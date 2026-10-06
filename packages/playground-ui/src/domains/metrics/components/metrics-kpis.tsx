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
import { KpiCards } from './kpi-cards';
import type { Kpi } from './kpi-cards';

const KEEP = { placeholderData: keepPreviousData };

const count = (value: number | null | undefined) => (value == null ? '—' : formatCount(value));
const change = (pct: number | null | undefined) => (pct == null || !Number.isFinite(pct) ? undefined : pct);
const previousCount = (value: number | null | undefined) => (value == null ? undefined : formatCount(value));

/** Agent runs, model cost, tokens and threads for the range, each against the previous range. */
export function MetricsKpis() {
  const filters = useMetricsFilters();
  const { comparisonLabel } = useMetrics();
  const runs = useAgentRunsKpiMetrics({ ...filters, queryOptions: KEEP });
  const cost = useModelCostKpiMetrics({ ...filters, queryOptions: KEEP });
  const tokens = useTotalTokensKpiMetrics({ ...filters, queryOptions: KEEP });
  const threads = useActiveThreadsKpiMetrics({ ...filters, queryOptions: KEEP });
  const queries = [runs, cost, tokens, threads];

  const kpis: Kpi[] = [
    {
      id: 'runs',
      label: 'Agent runs',
      icon: BotIcon,
      value: count(runs.data?.value),
      change: change(runs.data?.changePercent),
      detail: 'in this range',
      previous: previousCount(runs.data?.previousValue),
    },
    {
      id: 'cost',
      label: 'Model cost',
      icon: CoinsIcon,
      value: cost.data?.cost == null ? '—' : formatUsd(cost.data.cost),
      change: change(cost.data?.costChangePercent),
      lowerIsBetter: true,
      detail: 'estimated',
      previous: cost.data?.previousCost == null ? undefined : formatUsd(cost.data.previousCost),
    },
    {
      id: 'tokens',
      label: 'Tokens',
      icon: HashIcon,
      value: count(tokens.data?.value),
      change: change(tokens.data?.changePercent),
      detail: 'input and output',
      previous: previousCount(tokens.data?.previousValue),
    },
    {
      id: 'threads',
      label: 'Threads',
      icon: MessagesSquareIcon,
      value: count(threads.data?.value),
      change: change(threads.data?.changePercent),
      detail: 'with agent runs',
      previous: previousCount(threads.data?.previousValue),
    },
  ];

  return (
    <KpiCards
      kpis={kpis}
      isLoading={queries.some(q => q.isLoading)}
      isUpdating={queries.some(q => q.isPlaceholderData)}
      comparison={comparisonLabel}
    />
  );
}
