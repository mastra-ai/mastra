import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { MetricsCard } from '../../../ds/components/MetricsCard';
import { MetricsDataTable } from '../../../ds/components/MetricsDataTable';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import type { ActiveThreadRow } from '../hooks/use-top-active-threads-metrics';
import type { ResourceThreadsRow } from '../hooks/use-top-resources-by-threads-metrics';
import { formatCompact, formatCost } from './metrics-utils';

export type MemoryTab = 'threads' | 'resources';

/** Per-tab query state. Memory has two independent server queries (top
 *  threads + top resources) so loading/error are scoped to the active tab. */
type MemoryTabState<T> = {
  data: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
};

export interface MemoryCardViewProps {
  threads: MemoryTabState<ActiveThreadRow>;
  resources: MemoryTabState<ResourceThreadsRow>;
  /** Optional drilldown for a thread row. Receives the raw hook row. */
  getThreadRowHref?: (row: ActiveThreadRow) => string | undefined;
  /** Optional drilldown for a resource row. Receives the raw hook row. */
  getResourceRowHref?: (row: ResourceThreadsRow) => string | undefined;
  /** Optional slot for top-bar action buttons. Function form receives the active tab. */
  actions?: ReactNode | ((tab: MemoryTab) => ReactNode);
  /** Override how drilldown links are rendered. Defaults to `<a>`. */
  LinkComponent?: ElementType;
}

function isMemoryTab(value: string): value is MemoryTab {
  return value === 'threads' || value === 'resources';
}

// IDs are usually 32+ char UUIDs; the table is too narrow to show the full
// value without horizontal scroll, so we elide the middle.
function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

type ThreadTableRow = ActiveThreadRow & { key: string };
type ResourceTableRow = ResourceThreadsRow & { key: string };

export function MemoryCardView({
  threads,
  resources,
  getThreadRowHref,
  getResourceRowHref,
  actions,
  LinkComponent,
}: MemoryCardViewProps) {
  const [activeTab, setActiveTab] = useState<MemoryTab>('threads');

  const threadRows: ThreadTableRow[] = threads.data?.map(r => ({ ...r, key: r.threadId })) ?? [];
  const resourceRows: ResourceTableRow[] = resources.data?.map(r => ({ ...r, key: r.resourceId })) ?? [];

  const hasThreadData = threadRows.length > 0;
  const hasResourceData = resourceRows.length > 0;

  const threadTotal = threads.data?.reduce((s, r) => s + r.runs, 0) ?? 0;
  const resourceTotal = resources.data?.reduce((s, r) => s + r.threadCount, 0) ?? 0;

  const active = activeTab === 'threads' ? threads : resources;
  const renderedActions = typeof actions === 'function' ? actions(activeTab) : actions;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Memory" description="Resource and Thread consumption" />
        {activeTab === 'threads' && hasThreadData && (
          <MetricsCard.Summary value={threadTotal.toLocaleString()} label="Total runs" />
        )}
        {activeTab === 'resources' && hasResourceData && (
          <MetricsCard.Summary value={resourceTotal.toLocaleString()} label="Total threads" />
        )}
        {renderedActions ? <MetricsCard.Actions>{renderedActions}</MetricsCard.Actions> : null}
      </MetricsCard.TopBar>
      {active.isLoading ? (
        <MetricsCard.Loading />
      ) : active.isError ? (
        <MetricsCard.Error message="Failed to load memory data" />
      ) : (
        <MetricsCard.Content>
          <Tabs
            defaultTab="threads"
            value={activeTab}
            onValueChange={v => {
              if (isMemoryTab(v)) setActiveTab(v);
            }}
            className="grid grid-rows-[auto_1fr] overflow-y-auto h-full"
          >
            <TabList>
              <Tab value="threads">Threads</Tab>
              <Tab value="resources">Resources</Tab>
            </TabList>
            <TabContent value="threads">
              {hasThreadData ? (
                <MetricsDataTable
                  columns={[
                    { label: 'Thread ID', value: row => shortId(row.threadId) },
                    { label: 'Resource ID', value: row => (row.resourceId ? shortId(row.resourceId) : '—') },
                    { label: 'Runs', value: row => row.runs.toLocaleString(), highlight: true },
                    { label: 'Tokens', value: row => (row.tokens > 0 ? formatCompact(row.tokens) : '—') },
                    { label: 'Cost', value: row => (row.cost != null ? formatCost(row.cost, row.costUnit) : '—') },
                  ]}
                  data={threadRows}
                  LinkComponent={LinkComponent}
                  getRowHref={getThreadRowHref ? row => getThreadRowHref(row) : undefined}
                />
              ) : (
                <MetricsCard.NoData message="No thread activity yet" />
              )}
            </TabContent>
            <TabContent value="resources">
              {hasResourceData ? (
                <MetricsDataTable
                  columns={[
                    { label: 'Resource ID', value: row => shortId(row.resourceId) },
                    { label: 'Threads', value: row => row.threadCount.toLocaleString(), highlight: true },
                    { label: 'Tokens', value: row => (row.tokens > 0 ? formatCompact(row.tokens) : '—') },
                    { label: 'Cost', value: row => (row.cost != null ? formatCost(row.cost, row.costUnit) : '—') },
                  ]}
                  data={resourceRows}
                  LinkComponent={LinkComponent}
                  getRowHref={getResourceRowHref ? row => getResourceRowHref(row) : undefined}
                />
              ) : (
                <MetricsCard.NoData message="No resource activity yet" />
              )}
            </TabContent>
          </Tabs>
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
