import { EntityType } from '@mastra/core/observability';
import { useTokenUsageByAgentMetrics } from '@mastra/react/hooks/metrics';
import { keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { useMetricsScope } from '../hooks/use-metrics-scope';
import { useMetricsTokenSeries } from '../hooks/use-metrics-token-series';
import { useTokenSpend } from '../hooks/use-token-spend';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatCount, formatUsd } from '../lib/chart-format';
import { OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsShareListRow } from '@/ds/components/MetricsShareList';
import { MetricsShareList } from '@/ds/components/MetricsShareList';

type View = 'projects' | 'agents' | 'models' | 'threads';
type UsageRow = { key: string; label?: string; color?: string; cost: number; tokens: number; onClick?: () => void };

export type UsageCardProps = {
  /** Called from the "View in Traces" button. */
  onViewTraces?: () => void;
  /** Called with the agent name of the clicked row in the Agents tab. */
  onAgentClick?: (agentName: string) => void;
  /** Called with the model of the clicked row in the Models tab. */
  onModelClick?: (model: string) => void;
  /** Called with the thread ID of the clicked row in the Threads tab. */
  onThreadClick?: (threadId: string) => void;
  /** Called with the project of the clicked row in the Projects tab (organization pages only). */
  onProjectClick?: (projectId: string) => void;
};
type ViewProps = UsageCardProps & { onViewChange: (view: View) => void };

const KEEP = { placeholderData: keepPreviousData };
const COLUMNS = [{ label: 'Tokens' }];

/**
 * Who is spending: agents, models or threads ranked by cost share, with tokens; on organization
 * pages, projects too. Only the open tab loads.
 */
export function UsageCard(props: UsageCardProps) {
  const [view, setView] = useState<View>('agents');
  if (view === 'projects') return <ProjectsUsage {...props} onViewChange={setView} />;
  if (view === 'models') return <ModelsUsage {...props} onViewChange={setView} />;
  if (view === 'threads') return <ThreadsUsage {...props} onViewChange={setView} />;
  return <AgentsUsage {...props} onViewChange={setView} />;
}

function AgentsUsage(props: ViewProps) {
  const { onAgentClick } = props;
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
    onClick: onAgentClick && (() => onAgentClick(a.name)),
  }));
  return (
    <UsageFrame
      view="agents"
      {...props}
      rows={rows}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

function ModelsUsage(props: ViewProps) {
  const { onModelClick } = props;
  const { data = [], isLoading, isPlaceholderData, isError } = useTokenSpend('model');
  const rows = data.map(m => ({ ...m, onClick: onModelClick && (() => onModelClick(m.key)) }));
  return (
    <UsageFrame
      view="models"
      {...props}
      rows={rows}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

function ProjectsUsage(props: ViewProps) {
  const { onProjectClick } = props;
  const { projectLabel, projectColor } = useMetricsScope();
  // The same request as the Breakdown card's Projects tab.
  const { data, isLoading, isPlaceholderData, isError } = useMetricsTokenSeries({ groupBy: ['projectId'] });
  const rows = (data?.series ?? []).map(series => ({
    key: series.name,
    label: projectLabel?.(series.name) ?? series.name,
    color: projectColor?.(series.name),
    cost: series.points.reduce((sum, p) => sum + (p.estimatedCost ?? 0), 0),
    tokens: series.points.reduce((sum, p) => sum + p.value, 0),
    onClick: onProjectClick && (() => onProjectClick(series.name)),
  }));
  return (
    <UsageFrame
      view="projects"
      {...props}
      rows={rows}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    />
  );
}

function ThreadsUsage(props: ViewProps) {
  const { onThreadClick } = props;
  const { data = [], isLoading, isPlaceholderData, isError } = useTokenSpend('threadId');
  const rows = data.map(t => ({ ...t, onClick: onThreadClick && (() => onThreadClick(t.key)) }));
  return (
    <UsageFrame
      view="threads"
      {...props}
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
  onViewTraces,
  rows,
  isLoading,
  isUpdating,
  isError,
}: ViewProps & { view: View; rows: UsageRow[]; isLoading: boolean; isUpdating: boolean; isError: boolean }) {
  const byProject = useMetricsScope().projectLabel !== undefined;
  const tokensOf = new Map(rows.map(r => [r.key, r.tokens]));
  const shareRows: MetricsShareListRow[] = rows.map(r => ({
    key: r.key,
    label: r.label ?? r.key,
    color: r.color,
    share: r.cost,
    value: formatUsd(r.cost),
    cells: [formatCount(r.tokens)],
    onClick: r.onClick,
  }));

  const layout = {
    title: 'Usage',
    description: 'Who is spending: cost share, with tokens.',
    actions: onViewTraces && <OpenInTracesButton onClick={onViewTraces} />,
    toolbar: (
      <MetricsCard.Toolbar>
        <MetricsCard.Tabs<View> value={view} onValueChange={onViewChange}>
          {byProject && <MetricsCard.Tab value="projects">Projects</MetricsCard.Tab>}
          <MetricsCard.Tab value="agents">Agents</MetricsCard.Tab>
          <MetricsCard.Tab value="models">Models</MetricsCard.Tab>
          <MetricsCard.Tab value="threads">Threads</MetricsCard.Tab>
        </MetricsCard.Tabs>
        <MetricsShareList.Header columns={COLUMNS} valueLabel="Cost" />
      </MetricsCard.Toolbar>
    ),
  };

  if (isError) {
    return (
      <ChartCard {...layout}>
        <ChartCardError />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      {...layout}
      summary={
        <MetricsCard.Summary
          value={formatUsd(rows.reduce((sum, r) => sum + r.cost, 0))}
          label="cost"
          isLoading={isLoading}
        />
      }
      isUpdating={isUpdating}
    >
      <ChartArea>
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
          isLoading={isLoading}
        />
      </ChartArea>
    </ChartCard>
  );
}
