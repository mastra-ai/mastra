import { useTopActiveThreadsMetrics, useTopResourcesByThreadsMetrics } from '@mastra/react/hooks/metrics';
import { keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { useDrilldown } from '../hooks/use-drilldown';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatCount } from '../lib/chart-format';
import { OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsShareList } from '@/ds/components/MetricsShareList';
import type { MetricsShareListColumn, MetricsShareListRow } from '@/ds/components/MetricsShareList';
import { useLinkComponent } from '@/lib/framework';

type View = 'threads' | 'resources';

const KEEP = { placeholderData: keepPreviousData };

const VIEWS: Record<View, { valueLabel: string; columns: MetricsShareListColumn[]; summaryLabel: string }> = {
  threads: { valueLabel: 'Runs', columns: [{ label: 'Tokens' }], summaryLabel: 'runs' },
  resources: { valueLabel: 'Threads', columns: [{ label: 'Tokens' }], summaryLabel: 'threads' },
};

/** The busiest threads (by agent runs) or resources (by threads), ranked; a row opens its traces. */
export function MemoryCard() {
  const [view, setView] = useState<View>('threads');
  const { getTracesHref } = useDrilldown();
  const { Link } = useLinkComponent();
  const filters = useMetricsFilters();
  const threads = useTopActiveThreadsMetrics({ ...filters, queryOptions: KEEP });
  const resources = useTopResourcesByThreadsMetrics({ ...filters, queryOptions: KEEP });

  const rows: Record<View, MetricsShareListRow[]> = {
    threads: (threads.data ?? []).map(t => ({
      // A thread can come back once per resource, each with its own link.
      key: `${t.threadId}:${t.resourceId ?? ''}`,
      label: t.threadId,
      share: t.runs,
      value: formatCount(t.runs),
      cells: [formatCount(t.tokens)],
      href: getTracesHref({ threadId: t.threadId, ...(t.resourceId ? { resourceId: t.resourceId } : {}) }),
    })),
    resources: (resources.data ?? []).map(r => ({
      key: r.resourceId,
      label: r.resourceId,
      share: r.threadCount,
      value: formatCount(r.threadCount),
      cells: [formatCount(r.tokens)],
      href: getTracesHref({ resourceId: r.resourceId }),
    })),
  };
  const query = { threads, resources }[view];
  const spec = VIEWS[view];
  const total = rows[view].reduce((sum, r) => sum + r.share, 0);

  return (
    <ChartCard
      title="Memory"
      description="The busiest threads and resources."
      summary={{ value: formatCount(total), label: spec.summaryLabel }}
      actions={<OpenInTracesButton href={getTracesHref({})} LinkComponent={Link} />}
      isLoading={query.isLoading}
      isUpdating={query.isPlaceholderData}
      isError={query.isError}
    >
      <MetricsCard.Toolbar>
        <MetricsCard.Tabs<View> value={view} onValueChange={setView}>
          <MetricsCard.Tab value="threads">Threads</MetricsCard.Tab>
          <MetricsCard.Tab value="resources">Resources</MetricsCard.Tab>
        </MetricsCard.Tabs>
        <MetricsShareList.Header columns={spec.columns} valueLabel={spec.valueLabel} />
      </MetricsCard.Toolbar>
      <ChartArea isError={query.isError}>
        <MetricsShareList
          key={view}
          rows={rows[view]}
          columns={spec.columns}
          valueLabel={spec.valueLabel}
          showHeader={false}
          color={CHART_COLORS.violet}
          limit={8}
          overflow="more"
          emptyState={view === 'threads' ? 'No thread activity in this range.' : 'No resources in this range.'}
          LinkComponent={Link}
          isLoading={query.isLoading}
        />
      </ChartArea>
    </ChartCard>
  );
}
