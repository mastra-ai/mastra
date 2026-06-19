import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { DataList } from '../../../ds/components/DataList/data-list';
import { MetricsCard } from '../../../ds/components/MetricsCard/metrics-card';
import { TabContent } from '../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../ds/components/Tabs/tabs-tab';
import type { LinkComponent as DataListLinkComponent } from '../../../ds/types/link-component';
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
  const RowLinkComponent = (LinkComponent ?? 'a') as DataListLinkComponent;

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
                <DataList columns="auto auto auto auto auto" variant="lined" className="max-h-80">
                  <DataList.Top>
                    <DataList.TopCell sticky="start">Thread ID</DataList.TopCell>
                    <DataList.TopCell className="justify-end text-right">Resource ID</DataList.TopCell>
                    <DataList.TopCell className="justify-end text-right">Runs</DataList.TopCell>
                    <DataList.TopCell className="justify-end text-right">Tokens</DataList.TopCell>
                    <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
                  </DataList.Top>
                  {threadRows.map(row => {
                    const href = getThreadRowHref?.(row);
                    const rowCells = (
                      <>
                        <DataList.RowHeaderCell height="compact" className="text-ui-sm">
                          {shortId(row.threadId)}
                        </DataList.RowHeaderCell>
                        <DataList.Cell
                          height="compact"
                          className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                        >
                          {row.resourceId ? shortId(row.resourceId) : '—'}
                        </DataList.Cell>
                        <DataList.Cell
                          height="compact"
                          className="justify-items-end text-right text-ui-sm tabular-nums text-neutral4 font-semibold"
                        >
                          {row.runs.toLocaleString()}
                        </DataList.Cell>
                        <DataList.Cell
                          height="compact"
                          className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                        >
                          {row.tokens > 0 ? formatCompact(row.tokens) : '—'}
                        </DataList.Cell>
                        <DataList.Cell
                          height="compact"
                          className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                        >
                          {row.cost != null ? formatCost(row.cost, row.costUnit) : '—'}
                        </DataList.Cell>
                      </>
                    );

                    return href ? (
                      <DataList.RowLink key={row.key} to={href} LinkComponent={RowLinkComponent}>
                        {rowCells}
                      </DataList.RowLink>
                    ) : (
                      <DataList.RowStatic key={row.key}>{rowCells}</DataList.RowStatic>
                    );
                  })}
                </DataList>
              ) : (
                <MetricsCard.NoData message="No thread activity yet" />
              )}
            </TabContent>
            <TabContent value="resources">
              {hasResourceData ? (
                <DataList columns="auto auto auto auto" variant="lined" className="max-h-80">
                  <DataList.Top>
                    <DataList.TopCell sticky="start">Resource ID</DataList.TopCell>
                    <DataList.TopCell className="justify-end text-right">Threads</DataList.TopCell>
                    <DataList.TopCell className="justify-end text-right">Tokens</DataList.TopCell>
                    <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
                  </DataList.Top>
                  {resourceRows.map(row => {
                    const href = getResourceRowHref?.(row);
                    const rowCells = (
                      <>
                        <DataList.RowHeaderCell height="compact" className="text-ui-sm">
                          {shortId(row.resourceId)}
                        </DataList.RowHeaderCell>
                        <DataList.Cell
                          height="compact"
                          className="justify-items-end text-right text-ui-sm tabular-nums text-neutral4 font-semibold"
                        >
                          {row.threadCount.toLocaleString()}
                        </DataList.Cell>
                        <DataList.Cell
                          height="compact"
                          className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                        >
                          {row.tokens > 0 ? formatCompact(row.tokens) : '—'}
                        </DataList.Cell>
                        <DataList.Cell
                          height="compact"
                          className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                        >
                          {row.cost != null ? formatCost(row.cost, row.costUnit) : '—'}
                        </DataList.Cell>
                      </>
                    );

                    return href ? (
                      <DataList.RowLink key={row.key} to={href} LinkComponent={RowLinkComponent}>
                        {rowCells}
                      </DataList.RowLink>
                    ) : (
                      <DataList.RowStatic key={row.key}>{rowCells}</DataList.RowStatic>
                    );
                  })}
                </DataList>
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
