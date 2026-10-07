import { EntityType } from '@mastra/core/observability';
import { useTokenUsageByAgentMetrics } from '@mastra/react/hooks/metrics';
import { keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { useDrilldown } from '../hooks/use-drilldown';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { useTokenSpend } from '../hooks/use-token-spend';
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
type ViewProps = { onViewChange: (view: View) => void };

const KEEP = { placeholderData: keepPreviousData };
const COLUMNS = [{ label: 'Tokens' }];

/** Who is spending: agents, models or threads ranked by cost share, with tokens. Only the open tab loads. */
export function UsageCard() {
  const [view, setView] = useState<View>('agents');
  if (view === 'models') return <ModelsUsage onViewChange={setView} />;
  if (view === 'threads') return <ThreadsUsage onViewChange={setView} />;
  return <AgentsUsage onViewChange={setView} />;
}

function AgentsUsage({ onViewChange }: ViewProps) {
  const { getTracesHref } = useDrilldown();
  const {
    data = [],
    isLoading,
    isPlaceholderData,
    isError,
  } = useTokenUsageByAgentMetrics({
    ...useMetricsFilters(),
    queryOptions: KEEP,
  });
  const rows = data.map(a => ({
    key: a.name,
    cost: a.cost ?? 0,
    tokens: a.total,
    href: getTracesHref({ rootEntityType: EntityType.AGENT, entityName: a.name }),
  }));
  return (
    <UsageFrame
      view="agents"
      onViewChange={onViewChange}
      rows={rows}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

function ModelsUsage({ onViewChange }: ViewProps) {
  const { getTracesHref } = useDrilldown();
  const { data = [], isLoading, isPlaceholderData, isError } = useTokenSpend('model');
  const rows = data.map(m => ({ ...m, href: getTracesHref({ model: m.key }) }));
  return (
    <UsageFrame
      view="models"
      onViewChange={onViewChange}
      rows={rows}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

function ThreadsUsage({ onViewChange }: ViewProps) {
  const { getTracesHref } = useDrilldown();
  const { data = [], isLoading, isPlaceholderData, isError } = useTokenSpend('threadId');
  const rows = data.map(t => ({ ...t, href: getTracesHref({ threadId: t.key }) }));
  return (
    <UsageFrame
      view="threads"
      onViewChange={onViewChange}
      rows={rows}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

/** The card itself: tabs, the cost summary and the ranked list, for whichever tab is open. */
function UsageFrame({
  view,
  onViewChange,
  rows,
  isLoading,
  isUpdating,
  isError,
}: ViewProps & { view: View; rows: UsageRow[]; isLoading: boolean; isUpdating: boolean; isError: boolean }) {
  const { Link } = useLinkComponent();
  const { getTracesHref } = useDrilldown();
  const tokensOf = new Map(rows.map(r => [r.key, r.tokens]));
  const shareRows: MetricsShareListRow[] = rows.map(r => ({
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
      summary={{ value: formatUsd(rows.reduce((sum, r) => sum + r.cost, 0)), label: 'cost' }}
      actions={<OpenInTracesButton href={getTracesHref({})} LinkComponent={Link} />}
      isLoading={isLoading}
      isUpdating={isUpdating}
      isError={isError}
    >
      <MetricsCard.Toolbar>
        <MetricsCard.Tabs<View> value={view} onValueChange={onViewChange}>
          <MetricsCard.Tab value="agents">Agents</MetricsCard.Tab>
          <MetricsCard.Tab value="models">Models</MetricsCard.Tab>
          <MetricsCard.Tab value="threads">Threads</MetricsCard.Tab>
        </MetricsCard.Tabs>
        <MetricsShareList.Header columns={COLUMNS} valueLabel="Cost" />
      </MetricsCard.Toolbar>
      <ChartArea isError={isError}>
        <MetricsShareList
          rows={shareRows}
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
          isLoading={isLoading}
        />
      </ChartArea>
    </ChartCard>
  );
}
