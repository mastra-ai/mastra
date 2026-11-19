import { EntityType } from '@mastra/core/observability';
import { useTokenUsageByAgentMetrics } from '@mastra/react/hooks/metrics';
import { keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { useTokenSpend } from '../hooks/use-token-spend';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatCount, formatUsd } from '../lib/chart-format';
import { OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { ShareBar } from '@/ds/components/ShareBar';
import type { ShareBarRow } from '@/ds/components/ShareBar';

type View = 'agents' | 'models' | 'threads';

const VIEWS = [
  { value: 'agents', label: 'Agents' },
  { value: 'models', label: 'Models' },
  { value: 'threads', label: 'Threads' },
] as const;
type UsageRow = { key: string; cost: number; tokens: number; onClick?: () => void };

export type UsageCardProps = {
  /** Called from the "View in Traces" button. */
  onViewTraces?: () => void;
  /** Called with the agent name of the clicked row in the Agents tab. */
  onAgentClick?: (agentName: string) => void;
  /** Called with the model of the clicked row in the Models tab. */
  onModelClick?: (model: string) => void;
  /** Called with the thread ID of the clicked row in the Threads tab. */
  onThreadClick?: (threadId: string) => void;
};
type ViewProps = UsageCardProps & { onViewChange: (view: View) => void };

const KEEP = { placeholderData: keepPreviousData };
const COLUMNS = [{ label: 'Tokens' }];

/**
 * Who is spending: agents, models or threads ranked by cost share, with tokens. Only the open tab
 * loads. Each view keeps its own query, so one never shows another's rows while it loads, and one
 * card holds them all: switching keeps the card and its tabs, as the other cards' tabs do.
 */
export function UsageCard({ onViewTraces, onAgentClick, onModelClick, onThreadClick }: UsageCardProps) {
  const [view, setView] = useState<View>('agents');
  const agents = useTokenUsageByAgentMetrics({
    ...useMetricsFilters(),
    queryOptions: { ...KEEP, enabled: view === 'agents' },
  });
  const models = useTokenSpend('model', { enabled: view === 'models' });
  const threads = useTokenSpend('threadId', { enabled: view === 'threads' });

  const open = { agents, models, threads }[view];
  const spend = view === 'models' ? models.data : threads.data;
  const onSpendClick = view === 'models' ? onModelClick : onThreadClick;
  const rows: UsageRow[] =
    view === 'agents'
      ? (agents.data ?? []).map(a => ({
          key: a.name,
          cost: a.cost ?? 0,
          tokens: a.total,
          onClick: onAgentClick && (() => onAgentClick(a.name)),
        }))
      : (spend ?? []).map(r => ({ ...r, onClick: onSpendClick && (() => onSpendClick(r.key)) }));
  return (
    <UsageFrame
      view={view}
      onViewChange={setView}
      onViewTraces={onViewTraces}
      rows={rows}
      isLoading={open.isLoading}
      isUpdating={open.isPlaceholderData}
      isError={open.isError}
    />
  );
}

/** The card itself: the view tabs, the cost total and the ranked list, for whichever tab is open. */
function UsageFrame({
  view,
  onViewChange,
  onViewTraces,
  rows,
  isLoading,
  isUpdating,
  isError,
}: ViewProps & { view: View; rows: UsageRow[]; isLoading: boolean; isUpdating: boolean; isError: boolean }) {
  const tokensOf = new Map(rows.map(r => [r.key, r.tokens]));
  const shareRows: ShareBarRow[] = rows.map(r => ({
    key: r.key,
    label: r.key,
    share: r.cost,
    value: formatUsd(r.cost),
    cells: [formatCount(r.tokens)],
    onClick: r.onClick,
  }));

  const layout = {
    title: 'Usage',
    tabs: { value: view, onValueChange: onViewChange, options: VIEWS },
    actions: onViewTraces && <OpenInTracesButton onClick={onViewTraces} />,
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
      total={formatUsd(rows.reduce((sum, r) => sum + r.cost, 0))}
      isLoading={isLoading}
      isUpdating={isUpdating}
    >
      <ChartArea>
        <ShareBar
          key={view}
          rows={shareRows}
          columns={COLUMNS}
          valueLabel="Cost"
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
