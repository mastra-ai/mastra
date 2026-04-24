import { MetricsCard, MetricsDataTable, Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui';
import { useState } from 'react';
import { useDrilldown } from '../hooks/use-drilldown';
import { useTopActiveThreadsMetrics } from '../hooks/use-top-active-threads-metrics';
import { useTopResourcesByThreadsMetrics } from '../hooks/use-top-resources-by-threads-metrics';
import { formatCompact, formatCost } from './metrics-utils';

type ThreadRow = {
  key: string;
  threadIdFull: string;
  resourceIdFull: string | null;
  threadId: string;
  resourceId: string;
  runs: number;
  tokens: number;
  cost: number | null;
  costUnit: string | null;
};

type ResourceRow = {
  key: string;
  resourceIdFull: string;
  resourceId: string;
  threadCount: number;
  tokens: number;
  cost: number | null;
  costUnit: string | null;
};

export function MemoryCard() {
  const [activeTab, setActiveTab] = useState<'threads' | 'resources'>('threads');

  const threads = useTopActiveThreadsMetrics();
  const resources = useTopResourcesByThreadsMetrics();
  const { getTracesHref } = useDrilldown();

  const threadRows: ThreadRow[] =
    threads.data?.map(r => ({
      key: r.threadId,
      threadIdFull: r.threadId,
      resourceIdFull: r.resourceId ?? null,
      threadId: shortId(r.threadId),
      resourceId: r.resourceId ? shortId(r.resourceId) : '—',
      runs: r.runs,
      tokens: r.tokens,
      cost: r.cost,
      costUnit: r.costUnit,
    })) ?? [];

  const resourceRows: ResourceRow[] =
    resources.data?.map(r => ({
      key: r.resourceId,
      resourceIdFull: r.resourceId,
      resourceId: shortId(r.resourceId),
      threadCount: r.threadCount,
      tokens: r.tokens,
      cost: r.cost,
      costUnit: r.costUnit,
    })) ?? [];

  const hasThreadData = threadRows.length > 0;
  const hasResourceData = resourceRows.length > 0;

  const threadTotal = threads.data?.reduce((s, r) => s + r.runs, 0) ?? 0;
  const resourceTotal = resources.data?.reduce((s, r) => s + r.threadCount, 0) ?? 0;

  const active = activeTab === 'threads' ? threads : resources;

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
            onValueChange={v => setActiveTab(v as 'threads' | 'resources')}
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
                    { label: 'Thread ID', value: row => row.threadId },
                    { label: 'Resource ID', value: row => row.resourceId },
                    { label: 'Runs', value: row => row.runs.toLocaleString(), highlight: true },
                    { label: 'Tokens', value: row => (row.tokens > 0 ? formatCompact(row.tokens) : '—') },
                    { label: 'Cost', value: row => (row.cost != null ? formatCost(row.cost, row.costUnit) : '—') },
                  ]}
                  data={threadRows}
                  getRowHref={row =>
                    getTracesHref({
                      threadId: row.threadIdFull,
                      ...(row.resourceIdFull ? { resourceId: row.resourceIdFull } : {}),
                    })
                  }
                />
              ) : (
                <MetricsCard.NoData message="No thread activity yet" />
              )}
            </TabContent>
            <TabContent value="resources">
              {hasResourceData ? (
                <MetricsDataTable
                  columns={[
                    { label: 'Resource ID', value: row => row.resourceId },
                    { label: 'Threads', value: row => row.threadCount.toLocaleString(), highlight: true },
                    { label: 'Tokens', value: row => (row.tokens > 0 ? formatCompact(row.tokens) : '—') },
                    { label: 'Cost', value: row => (row.cost != null ? formatCost(row.cost, row.costUnit) : '—') },
                  ]}
                  data={resourceRows}
                  getRowHref={row => getTracesHref({ resourceId: row.resourceIdFull })}
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

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
