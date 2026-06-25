import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTraces } from '../../../domains/traces/hooks';
import { EmptyState } from '../../../ds/components/EmptyState';
import { ErrorState } from '../../../ds/components/ErrorState';
import { ScatterPlotChart } from '../../../ds/components/ScatterPlotChart';
import { Skeleton } from '../../../ds/components/Skeleton/skeleton';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import { stringToColor } from '../../../lib/colors';
import { cn } from '../../../lib/utils';
import type { TopicTraceSummary } from '../../topics';
import { TopicTraceDetailsPanel, TopicTraceSummaryList, TopicsLayout } from '../../topics';
import { useEntityForSignal } from '../hooks/use-entity-learning';
import { useSignalPoints } from '../hooks/use-signal-points';
import { useSignalTopics } from '../hooks/use-signal-topics';
import { useTopicExamples } from '../hooks/use-topic-examples';
import type { EntityLearningExample, EntityLearningPoint, EntityLearningTopic } from '../types';

const SignalTraceSummaryList = TopicTraceSummaryList;
export const SignalTraceDetailsPanel = TopicTraceDetailsPanel;
const SignalsLayout = TopicsLayout;

const OUTLIER_COLOR = '#a1a1aa';

type SignalTab = 'trace-list' | 'chart';

// Adapt an Entity Learning example into the generic topics trace summary shape.
// This is the only allowed boundary adaptation — the domain model stays as the
// API types and is only reshaped where the reused topics list requires it.
function exampleToTraceSummary(example: EntityLearningExample): TopicTraceSummary {
  return {
    id: example.traceId,
    name: example.signalText,
  };
}

interface SignalTopicSidebarProps {
  topics: EntityLearningTopic[];
  selectedTopicIds: string[];
  onTopicSelect: (topicId: string) => void;
  multiple?: boolean;
  ariaLabel?: string;
}

export function SignalTopicSidebar({
  topics,
  selectedTopicIds,
  onTopicSelect,
  multiple = false,
  ariaLabel = 'Signal clusters',
}: SignalTopicSidebarProps) {
  return (
    <aside
      className="min-h-0 w-72 shrink-0 overflow-y-auto border-r border-border1/60 pr-4 py-4"
      aria-label={ariaLabel}
    >
      <ul className="space-y-1" role={multiple ? 'group' : undefined}>
        {topics.map(topic => {
          const selected = selectedTopicIds.includes(topic.topicId);
          return (
            <li key={topic.topicId}>
              <button
                type="button"
                role={multiple ? 'checkbox' : undefined}
                aria-checked={multiple ? selected : undefined}
                aria-pressed={multiple ? undefined : selected}
                className="group cursor-pointer w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface3 aria-pressed:bg-surface3 aria-checked:bg-surface3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1"
                onClick={() => onTopicSelect(topic.topicId)}
              >
                <span className="flex items-start gap-2">
                  <span
                    className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', multiple && !selected && 'invisible')}
                    style={{ backgroundColor: stringToColor(topic.name) }}
                  />
                  <span className="min-w-0 space-y-1">
                    <span
                      className={cn(
                        'block text-sm font-medium',
                        multiple && !selected ? 'text-neutral3' : 'text-neutral5',
                      )}
                    >
                      {topic.name}
                    </span>
                    <span
                      className={cn(
                        'line-clamp-2 block text-sm',
                        multiple && !selected ? 'text-neutral1' : 'text-neutral2',
                      )}
                    >
                      {topic.description}
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

interface SignalTraceListTabProps {
  entityId: string;
  topicId: string;
  signalName: string;
  runId: string;
  selectedTraceId: string | null;
  onTraceSelect: () => void;
}

export function SignalTraceListTab({
  entityId,
  topicId,
  signalName,
  runId,
  selectedTraceId,
  onTraceSelect,
}: SignalTraceListTabProps) {
  const { data: examples, isPending, error } = useTopicExamples(entityId, topicId, signalName, runId);
  const traces = useMemo(() => (examples ?? []).map(exampleToTraceSummary), [examples]);

  if (isPending) {
    return (
      <div className="space-y-2" aria-label="Loading traces">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Couldn't load traces" message="Failed to load traces for this cluster." />;
  }

  return <SignalTraceSummaryList traces={traces} selectedTraceId={selectedTraceId} onTraceSelect={onTraceSelect} />;
}

function pointToChartDatum(point: EntityLearningPoint) {
  return {
    x: point.x,
    y: point.y,
    name: point.exampleId,
    color: point.isOutlier ? OUTLIER_COLOR : stringToColor(point.topicId ?? point.exampleId),
  };
}

interface SignalChartTabProps {
  entityId: string;
  signalName: string;
  runId: string;
  topics: EntityLearningTopic[];
  selectedTopicIds: string[];
  onTopicToggle: (topicId: string) => void;
}

export function SignalChartTab({
  entityId,
  signalName,
  runId,
  topics,
  selectedTopicIds,
  onTopicToggle,
}: SignalChartTabProps) {
  const { data: points, isPending, error } = useSignalPoints(entityId, signalName, runId);

  const chartData = useMemo(() => {
    const selected = new Set(selectedTopicIds);
    return (points ?? []).filter(point => point.topicId == null || selected.has(point.topicId)).map(pointToChartDatum);
  }, [points, selectedTopicIds]);

  return (
    <div className="flex h-full min-w-0 gap-6">
      <SignalTopicSidebar
        topics={topics}
        selectedTopicIds={selectedTopicIds}
        onTopicSelect={onTopicToggle}
        multiple
        ariaLabel="Chart cluster filters"
      />
      <div className="min-h-0 min-w-0 flex-1 py-4">
        {isPending ? (
          <Skeleton className="h-full w-full rounded-md" aria-label="Loading chart" />
        ) : error ? (
          <ErrorState title="Couldn't load chart" message="Failed to load projection points for this signal." />
        ) : (
          <ScatterPlotChart
            data={chartData}
            xKey="x"
            yKey="y"
            nameKey="name"
            colorKey="color"
            height="100%"
            className="h-full"
            xLabel="x"
            yLabel="y"
          />
        )}
      </div>
    </div>
  );
}

interface SignalTopicTabsProps {
  entityId: string;
  signalName: string;
  runId: string;
  topics: EntityLearningTopic[];
  selectedTopic: EntityLearningTopic;
  selectedTraceId: string | null;
  selectedChartTopicIds: string[];
  activeTab: SignalTab;
  onActiveTabChange: (tab: SignalTab) => void;
  onTopicSelect: (topicId: string) => void;
  onChartTopicToggle: (topicId: string) => void;
  onTraceSelect: () => void;
}

export function SignalTopicTabs({
  entityId,
  signalName,
  runId,
  topics,
  selectedTopic,
  selectedTraceId,
  selectedChartTopicIds,
  activeTab,
  onActiveTabChange,
  onTopicSelect,
  onChartTopicToggle,
  onTraceSelect,
}: SignalTopicTabsProps) {
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
          <SignalTopicSidebar
            topics={topics}
            selectedTopicIds={[selectedTopic.topicId]}
            onTopicSelect={onTopicSelect}
          />
          <div className="min-w-0 flex-1 overflow-hidden py-4">
            <SignalTraceListTab
              entityId={entityId}
              topicId={selectedTopic.topicId}
              signalName={signalName}
              runId={runId}
              selectedTraceId={selectedTraceId}
              onTraceSelect={onTraceSelect}
            />
          </div>
        </div>
      </TabContent>
      <TabContent value="chart" className="min-h-0 flex-1 overflow-hidden py-0">
        <SignalChartTab
          entityId={entityId}
          signalName={signalName}
          runId={runId}
          topics={topics}
          selectedTopicIds={selectedChartTopicIds}
          onTopicToggle={onChartTopicToggle}
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
  const { data: entity, isFetching: entityFetching, error: entityError } = useEntityForSignal(signalId);
  const entityId = entity?.entityId;
  const runId = entity?.latestRunId;

  const {
    data: topicsData,
    isFetching: topicsFetching,
    error: topicsError,
  } = useSignalTopics(entityId, signalId, runId);
  const topics = useMemo(() => topicsData?.topics ?? [], [topicsData]);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedChartTopicIds, setSelectedChartTopicIds] = useState<string[] | null>(null);
  const [activeTab, setActiveTab] = useState<SignalTab>('trace-list');

  const selectedTopic = topics.find(topic => topic.topicId === selectedTopicId) ?? topics[0];
  const chartTopicIds = selectedChartTopicIds ?? topics.map(topic => topic.topicId);

  const { data: tracesData } = useTraces({});
  const resolvedTraceId = tracesData?.spans[0]?.traceId ?? null;

  const handleTraceSelect = () => {
    if (!signalId || !resolvedTraceId) return;
    onTraceSelect(signalId, resolvedTraceId);
  };

  const handleChartTopicToggle = (topicId: string) => {
    setSelectedChartTopicIds(current => {
      const base = current ?? topics.map(topic => topic.topicId);
      return base.includes(topicId) ? base.filter(id => id !== topicId) : [...base, topicId];
    });
  };

  const error = entityError ?? topicsError;
  const isLoading = !error && (entityFetching || topicsFetching);

  return (
    <SignalsLayout sidebar={null} tracePanel={activeTab === 'trace-list' ? tracePanel : undefined}>
      <section className="flex h-full min-w-0 flex-col gap-4">
        <header className="space-y-1">
          <h1 className="text-icon-xl font-semibold text-neutral6 capitalize">{signalId}</h1>
          <p className="text-ui-sm text-neutral3">Explore trace patterns by cluster.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full min-w-0 gap-6" aria-label="Loading signal">
              <div className="w-72 shrink-0 space-y-2 py-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <div className="min-w-0 flex-1 py-4">
                <Skeleton className="h-full w-full rounded-md" />
              </div>
            </div>
          ) : error ? (
            <ErrorState title="Couldn't load signal" message="Failed to load entity learning data for this signal." />
          ) : !entity || !selectedTopic ? (
            <EmptyState
              iconSlot={null}
              titleSlot="Signal not found"
              descriptionSlot="No clusters were found for this signal."
            />
          ) : (
            <SignalTopicTabs
              entityId={entity.entityId}
              signalName={signalId!}
              runId={entity.latestRunId}
              topics={topics}
              selectedTopic={selectedTopic}
              selectedTraceId={selectedTraceId}
              selectedChartTopicIds={chartTopicIds}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              onTopicSelect={setSelectedTopicId}
              onChartTopicToggle={handleChartTopicToggle}
              onTraceSelect={handleTraceSelect}
            />
          )}
        </div>
      </section>
    </SignalsLayout>
  );
}
