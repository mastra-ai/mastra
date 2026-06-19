import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../../../ds/components/Badge';
import { Checkbox } from '../../../ds/components/Checkbox';
import { ScatterPlotChart } from '../../../ds/components/ScatterPlotChart';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import { stringToColor } from '../../../lib/colors';
import { useTraces } from '../../../domains/traces/hooks';
import { TopicTraceDetailsPanel, TopicTraceSummaryList, TopicsLayout } from '../../topics';
import { getSignalChartData } from '../signals-chart-data';
import { signals } from '../signals-data';
import type { Signal, SignalFacet } from '../types';

const SignalTraceSummaryList = TopicTraceSummaryList;
export const SignalTraceDetailsPanel = TopicTraceDetailsPanel;
const SignalsLayout = TopicsLayout;

type SignalTab = 'trace-list' | 'chart';

function findFacetByTraceId(signal: Signal | undefined, traceId: string | undefined) {
  if (!signal || !traceId) return undefined;
  return signal.facets.find(facet => facet.traceSummaries.some(trace => trace.id === traceId));
}

export function getSignalName(signalId: string) {
  return signals.find(signal => signal.id === signalId)?.name ?? signalId;
}

interface SignalFacetSidebarProps {
  signal: Signal;
  selectedFacetId: string | null;
  onFacetSelect: (facetId: string) => void;
}

export function SignalFacetSidebar({ signal, selectedFacetId, onFacetSelect }: SignalFacetSidebarProps) {
  return (
    <aside className="min-h-0 w-72 shrink-0 overflow-y-auto border-r border-border1/60 pr-4 py-4" aria-label="Signal facets">
      <ul className="space-y-1">
        {signal.facets.map(facet => {
          const selected = facet.id === selectedFacetId;
          return (
            <li key={facet.id}>
              <button
                type="button"
                aria-pressed={selected}
                className="cursor-pointer w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface3 aria-pressed:bg-surface3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1"
                onClick={() => onFacetSelect(facet.id)}
              >
                <span className="flex items-start gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stringToColor(facet.name) }} />
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-medium text-neutral5">{facet.name}</span>
                    <span className="line-clamp-2 block text-sm text-neutral2">{facet.description}</span>
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
  facet,
  selectedTraceId,
  onTraceSelect,
}: {
  facet: SignalFacet;
  selectedTraceId: string | null;
  onTraceSelect: () => void;
}) {
  return <SignalTraceSummaryList traces={facet.traceSummaries} selectedTraceId={selectedTraceId} onTraceSelect={onTraceSelect} />;
}

interface SignalChartTabProps {
  signal: Signal;
  selectedFacetIds: string[];
  onFacetToggle: (facetId: string) => void;
}

export function SignalChartTab({ signal, selectedFacetIds, onFacetToggle }: SignalChartTabProps) {
  const selectedFacets = useMemo(
    () => signal.facets.filter(facet => selectedFacetIds.includes(facet.id)),
    [signal.facets, selectedFacetIds],
  );
  const chartData = useMemo(() => getSignalChartData(selectedFacets), [selectedFacets]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2" aria-label="Chart facet filters">
        {signal.facets.map(facet => {
          const selected = selectedFacetIds.includes(facet.id);
          return (
            <label key={facet.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-border1/70 bg-surface2 px-3 py-1.5 text-ui-sm text-neutral5 transition-colors hover:bg-surface3">
              <Checkbox checked={selected} onCheckedChange={() => onFacetToggle(facet.id)} aria-label={`Toggle ${facet.name}`} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stringToColor(facet.name) }} />
              <span>{facet.name}</span>
              <Badge variant="default">
                {facet.traceSummaries.length} {facet.traceSummaries.length === 1 ? 'trace' : 'traces'}
              </Badge>
            </label>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
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

interface SignalFacetTabsProps {
  signal: Signal;
  selectedFacet: SignalFacet;
  selectedTraceId: string | null;
  selectedChartFacetIds: string[];
  activeTab: SignalTab;
  onActiveTabChange: (tab: SignalTab) => void;
  onFacetSelect: (facetId: string) => void;
  onChartFacetToggle: (facetId: string) => void;
  onTraceSelect: () => void;
}

export function SignalFacetTabs({
  signal,
  selectedFacet,
  selectedTraceId,
  selectedChartFacetIds,
  activeTab,
  onActiveTabChange,
  onFacetSelect,
  onChartFacetToggle,
  onTraceSelect,
}: SignalFacetTabsProps) {
  return (
    <Tabs<SignalTab> defaultTab="trace-list" value={activeTab} onValueChange={onActiveTabChange} className="flex h-full min-h-0 flex-col overflow-hidden">
      <TabList variant="line">
        <Tab value="trace-list">Trace list</Tab>
        <Tab value="chart">Chart</Tab>
      </TabList>
      <TabContent value="trace-list" className="min-h-0 flex-1 overflow-hidden py-0">
        <div className="flex h-full min-w-0 gap-6">
          <SignalFacetSidebar signal={signal} selectedFacetId={selectedFacet.id} onFacetSelect={onFacetSelect} />
          <div className="min-w-0 flex-1 overflow-hidden py-4">
            <SignalTraceListTab facet={selectedFacet} selectedTraceId={selectedTraceId} onTraceSelect={onTraceSelect} />
          </div>
        </div>
      </TabContent>
      <TabContent value="chart" className="min-h-0 flex-1 overflow-hidden py-4">
        <SignalChartTab signal={signal} selectedFacetIds={selectedChartFacetIds} onFacetToggle={onChartFacetToggle} />
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
  const initialFacet = findFacetByTraceId(selectedSignal, selectedTraceId ?? undefined) ?? selectedSignal?.facets[0];
  const [selectedFacetId, setSelectedFacetId] = useState<string | null>(() => initialFacet?.id ?? null);
  const [selectedChartFacetIds, setSelectedChartFacetIds] = useState<string[]>(() => selectedSignal?.facets.map(facet => facet.id) ?? []);
  const [activeTab, setActiveTab] = useState<SignalTab>('trace-list');
  const selectedFacet = selectedSignal?.facets.find(facet => facet.id === selectedFacetId) ?? initialFacet;
  const { data: tracesData } = useTraces({});
  const resolvedTraceId = tracesData?.spans[0]?.traceId ?? null;

  const handleTraceSelect = () => {
    if (!selectedSignal || !resolvedTraceId) return;

    onTraceSelect(selectedSignal.id, resolvedTraceId);
  };

  const handleChartFacetToggle = (facetId: string) => {
    setSelectedChartFacetIds(current => (current.includes(facetId) ? current.filter(id => id !== facetId) : [...current, facetId]));
  };

  if (!selectedSignal || !selectedFacet) {
    return <SignalsLayout sidebar={null}>Signal not found</SignalsLayout>;
  }

  return (
    <SignalsLayout sidebar={null} tracePanel={activeTab === 'trace-list' ? tracePanel : undefined}>
      <section className="flex h-full min-w-0 flex-col gap-4">
        <header className="space-y-1">
          <h1 className="text-icon-xl font-semibold text-neutral6">{selectedSignal.name}</h1>
          <p className="text-ui-sm text-neutral3">Explore trace patterns by facet.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SignalFacetTabs
            signal={selectedSignal}
            selectedFacet={selectedFacet}
            selectedTraceId={selectedTraceId}
            selectedChartFacetIds={selectedChartFacetIds}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            onFacetSelect={setSelectedFacetId}
            onChartFacetToggle={handleChartFacetToggle}
            onTraceSelect={handleTraceSelect}
          />
        </div>
      </section>
    </SignalsLayout>
  );
}
