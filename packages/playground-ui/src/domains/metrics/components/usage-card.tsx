import { EntityType } from '@mastra/core/observability';
import { useTokenUsageByAgentMetrics, useTopActiveThreadsMetrics } from '@mastra/react/hooks/metrics';
import { keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { useDrilldown } from '../hooks/use-drilldown';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { useModelUsage } from '../hooks/use-model-usage';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatCount, formatUsd } from '../lib/chart-format';
import { OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsShareListRow } from '@/ds/components/MetricsShareList';
import { MetricsShareList } from '@/ds/components/MetricsShareList';
import { useLinkComponent } from '@/lib/framework';

type View = 'agents' | 'models' | 'threads';
type UsageRow = { key: string; cost: number; tokens: number; href: string };

const KEEP = { placeholderData: keepPreviousData };
const COLUMNS = [{ label: 'Tokens' }];

/** Who is spending: agents, models or threads ranked by cost share, with tokens. */
export function UsageCard() {
  const { Link } = useLinkComponent();
  const [view, setView] = useState<View>('agents');
  const { getTracesHref } = useDrilldown();
  const filters = useMetricsFilters();
  const agents = useTokenUsageByAgentMetrics({ ...filters, queryOptions: KEEP });
  const models = useModelUsage();
  const threads = useTopActiveThreadsMetrics({ ...filters, queryOptions: KEEP });

  const sources: Record<View, UsageRow[]> = {
    agents: (agents.data ?? []).map(a => ({
      key: a.name,
      cost: a.cost ?? 0,
      tokens: a.total,
      href: getTracesHref({ rootEntityType: EntityType.AGENT, entityName: a.name }),
    })),
    models: (models.data ?? []).map(m => ({
      key: m.model,
      cost: m.cost,
      tokens: m.tokens,
      href: getTracesHref({ model: m.model }),
    })),
    threads: uniqueThreads(threads.data ?? []).map(t => ({
      key: t.threadId,
      cost: t.cost ?? 0,
      tokens: t.tokens,
      href: getTracesHref({ threadId: t.threadId }),
    })),
  };
  const query = { agents, models, threads }[view];
  const source = sources[view];
  const tokensOf = new Map(source.map(r => [r.key, r.tokens]));
  const rows: MetricsShareListRow[] = source.map(r => ({
    key: r.key,
    label: r.key,
    share: r.cost,
    value: formatUsd(r.cost),
    cells: [formatCount(r.tokens)],
    href: r.href,
  }));

  return (
    <ChartCard
      title="Usage"
      description="Who is spending: cost share, with tokens."
      summary={{ value: formatUsd(source.reduce((sum, r) => sum + r.cost, 0)), label: 'cost' }}
      actions={<OpenInTracesButton href={getTracesHref({})} LinkComponent={Link} />}
      isLoading={query.isLoading}
      isUpdating={query.isPlaceholderData}
      isError={query.isError}
    >
      <MetricsCard.Toolbar>
        <MetricsCard.Tabs<View> value={view} onValueChange={setView}>
          <MetricsCard.Tab value="agents">Agents</MetricsCard.Tab>
          <MetricsCard.Tab value="models">Models</MetricsCard.Tab>
          <MetricsCard.Tab value="threads">Threads</MetricsCard.Tab>
        </MetricsCard.Tabs>
        <MetricsShareList.Header columns={COLUMNS} valueLabel="Cost" />
      </MetricsCard.Toolbar>
      <ChartArea isError={query.isError}>
        <MetricsShareList
          key={view}
          rows={rows}
          columns={COLUMNS}
          valueLabel="Cost"
          showHeader={false}
          color={CHART_COLORS.green}
          other={rest => ({
            value: formatUsd(rest.reduce((sum, r) => sum + r.share, 0)),
            cells: [formatCount(rest.reduce((sum, r) => sum + (tokensOf.get(r.key) ?? 0), 0))],
          })}
          emptyState="No model usage in this range."
          LinkComponent={Link}
          isLoading={query.isLoading}
        />
      </ChartArea>
    </ChartCard>
  );
}

/** A thread comes back once per resource; its tokens and cost are per thread already. */
function uniqueThreads<T extends { threadId: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (seen.has(row.threadId)) return false;
    seen.add(row.threadId);
    return true;
  });
}
