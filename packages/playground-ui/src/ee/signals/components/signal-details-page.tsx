import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTraces } from '../../../domains/traces/hooks';
import { ScatterPlotChart } from '../../../ds/components/ScatterPlotChart';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import { stringToColor } from '../../../lib/colors';
import { cn } from '../../../lib/utils';
import { TopicTraceDetailsPanel, TopicTraceSummaryList, TopicsLayout } from '../../topics';
import { getSignalChartData } from '../signals-chart-data';
import { signals } from '../signals-data';
import type { Signal, SignalCluster } from '../types';

const SignalTraceSummaryList = TopicTraceSummaryList;
export const SignalTraceDetailsPanel = TopicTraceDetailsPanel;
const SignalsLayout = TopicsLayout;

type SignalTab = 'trace-list' | 'chart';

function findClusterByTraceId(signal: Signal | undefined, traceId: string | undefined) {
  if (!signal || !traceId) return undefined;
  return signal.clusters.find(cluster => cluster.traceSummaries.some(trace => trace.id === traceId));
}

export function getSignalName(signalId: string) {
  return signals.find(signal => signal.id === signalId)?.name ?? signalId;
}

interface SignalClusterSidebarProps {
  signal: Signal;
  selectedClusterIds: string[];
  onClusterSelect: (clusterId: string) => void;
  multiple?: boolean;
  ariaLabel?: string;
}

export function SignalClusterSidebar({
  signal,
  selectedClusterIds,
  onClusterSelect,
  multiple = false,
  ariaLabel = 'Signal clusters',
}: SignalClusterSidebarProps) {
  return (
    <aside
      className="min-h-0 w-72 shrink-0 overflow-y-auto border-r border-border1/60 pr-4 py-4"
      aria-label={ariaLabel}
    >
      <ul className="space-y-1" role={multiple ? 'group' : undefined}>
        {signal.clusters.map(cluster => {
          const selected = selectedClusterIds.includes(cluster.id);
          return (
            <li key={cluster.id}>
              <button
                type="button"
                role={multiple ? 'checkbox' : undefined}
                aria-checked={multiple ? selected : undefined}
                aria-pressed={multiple ? undefined : selected}
                className="group cursor-pointer w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface3 aria-pressed:bg-surface3 aria-checked:bg-surface3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1"
                onClick={() => onClusterSelect(cluster.id)}
              >
                <span className="flex items-start gap-2">
                  <span
                    className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', multiple && !selected && 'invisible')}
                    style={{ backgroundColor: stringToColor(cluster.name) }}
                  />
                  <span className="min-w-0 space-y-1">
                    <span
                      className={cn(
                        'block text-sm font-medium',
                        multiple && !selected ? 'text-neutral3' : 'text-neutral5',
                      )}
                    >
                      {cluster.name}
                    </span>
                    <span
                      className={cn(
                        'line-clamp-2 block text-sm',
                        multiple && !selected ? 'text-neutral1' : 'text-neutral2',
                      )}
                    >
                      {cluster.description}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function SignalTraceListTab({
  cluster,
  selectedTraceId,
  onTraceSelect,
}: {
  cluster: SignalCluster;
  selectedTraceId: string | null;
  onTraceSelect: () => void;
}) {
  return (
    <SignalTraceSummaryList
      traces={cluster.traceSummaries}
      selectedTraceId={selectedTraceId}
      onTraceSelect={onTraceSelect}
    />
  );
}

interface SignalChartTabProps {
  signal: Signal;
  selectedClusterIds: string[];
  onClusterToggle: (clusterId: string) => void;
}

export function SignalChartTab({ signal, selectedClusterIds, onClusterToggle }: SignalChartTabProps) {
  const selectedClusters = useMemo(
    () => signal.clusters.filter(cluster => selectedClusterIds.includes(cluster.id)),
    [signal.clusters, selectedClusterIds],
  );
  const chartData = useMemo(() => getSignalChartData(selectedClusters), [selectedClusters]);

  return (
    <div className="flex h-full min-w-0 gap-6">
      <SignalClusterSidebar
        signal={signal}
        selectedClusterIds={selectedClusterIds}
        onClusterSelect={onClusterToggle}
        multiple
        ariaLabel="Chart cluster filters"
      />
      <div className="min-h-0 min-w-0 flex-1 py-4">
        <ScatterPlotChart
          data={chartData}
          xKey="duration"
          yKey="spans"
          nameKey="name"
          colorKey="color"
          height="100%"
          className="h-full"
          xLabel="Duration"
          yLabel="Spans"
          formatX={value => `${value}ms`}
          formatY={value => `${value} spans`}
        />
      </div>
    </div>
  );
}

interface SignalClusterTabsProps {
  signal: Signal;
  selectedCluster: SignalCluster;
  selectedTraceId: string | null;
  selectedChartClusterIds: string[];
  activeTab: SignalTab;
  onActiveTabChange: (tab: SignalTab) => void;
  onClusterSelect: (clusterId: string) => void;
  onChartClusterToggle: (clusterId: string) => void;
  onTraceSelect: () => void;
}

export function SignalClusterTabs({
  signal,
  selectedCluster,
  selectedTraceId,
  selectedChartClusterIds,
  activeTab,
  onActiveTabChange,
  onClusterSelect,
  onChartClusterToggle,
  onTraceSelect,
}: SignalClusterTabsProps) {
  return (
    <Tabs<SignalTab>
      defaultTab="trace-list"
      value={activeTab}
      onValueChange={onActiveTabChange}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <TabList variant="line">
        <Tab value="trace-list">Trace list</Tab>
        <Tab value="chart">Chart</Tab>
      </TabList>
      <TabContent value="trace-list" className="min-h-0 flex-1 overflow-hidden py-0">
        <div className="flex h-full min-w-0 gap-6">
          <SignalClusterSidebar
            signal={signal}
            selectedClusterIds={[selectedCluster.id]}
            onClusterSelect={onClusterSelect}
          />
          <div className="min-w-0 flex-1 overflow-hidden py-4">
            <SignalTraceListTab
              cluster={selectedCluster}
              selectedTraceId={selectedTraceId}
              onTraceSelect={onTraceSelect}
            />
          </div>
        </div>
      </TabContent>
      <TabContent value="chart" className="min-h-0 flex-1 overflow-hidden py-0">
        <SignalChartTab
          signal={signal}
          selectedClusterIds={selectedChartClusterIds}
          onClusterToggle={onChartClusterToggle}
        />
      </TabContent>
    </Tabs>
  );
}

export interface SignalDetailsPageProps {
  signalId?: string;
  selectedTraceId: string | null;
  tracePanel?: ReactNode;
  onTraceSelect: (signalId: string, traceId: string) => void;
}

export function SignalDetailsPage({ signalId, selectedTraceId, tracePanel, onTraceSelect }: SignalDetailsPageProps) {
  const selectedSignal = useMemo(() => signals.find(signal => signal.id === signalId), [signalId]);
  const initialCluster =
    findClusterByTraceId(selectedSignal, selectedTraceId ?? undefined) ?? selectedSignal?.clusters[0];
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(() => initialCluster?.id ?? null);
  const [selectedChartClusterIds, setSelectedChartClusterIds] = useState<string[]>(
    () => selectedSignal?.clusters.map(cluster => cluster.id) ?? [],
  );
  const [activeTab, setActiveTab] = useState<SignalTab>('trace-list');
  const selectedCluster = selectedSignal?.clusters.find(cluster => cluster.id === selectedClusterId) ?? initialCluster;
  const { data: tracesData } = useTraces({});
  const resolvedTraceId = tracesData?.spans[0]?.traceId ?? null;

  const handleTraceSelect = () => {
    if (!selectedSignal || !resolvedTraceId) return;

    onTraceSelect(selectedSignal.id, resolvedTraceId);
  };

  const handleChartClusterToggle = (clusterId: string) => {
    setSelectedChartClusterIds(current =>
      current.includes(clusterId) ? current.filter(id => id !== clusterId) : [...current, clusterId],
    );
  };

  if (!selectedSignal || !selectedCluster) {
    return <SignalsLayout sidebar={null}>Signal not found</SignalsLayout>;
  }

  return (
    <SignalsLayout sidebar={null} tracePanel={activeTab === 'trace-list' ? tracePanel : undefined}>
      <section className="flex h-full min-w-0 flex-col gap-4">
        <header className="space-y-1">
          <h1 className="text-icon-xl font-semibold text-neutral6">{selectedSignal.name}</h1>
          <p className="text-ui-sm text-neutral3">Explore trace patterns by cluster.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SignalClusterTabs
            signal={selectedSignal}
            selectedCluster={selectedCluster}
            selectedTraceId={selectedTraceId}
            selectedChartClusterIds={selectedChartClusterIds}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            onClusterSelect={setSelectedClusterId}
            onChartClusterToggle={handleChartClusterToggle}
            onTraceSelect={handleTraceSelect}
          />
        </div>
      </section>
    </SignalsLayout>
  );
}
