import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../ds/components/Button';
import { DataList } from '../../../ds/components/DataList/data-list';
import { ScatterPlotChart } from '../../../ds/components/ScatterPlotChart';
import { Searchbar } from '../../../ds/components/Searchbar';
import { Skeleton } from '../../../ds/components/Skeleton';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import { cn } from '../../../lib/utils';
import { TopicTraceDetailsPanel, TopicsLayout } from '../../topics';
import { useEntities, useEntityPoints, useEntityTopicExamples, useEntityTopics } from '../hooks';
import type { EntityLearningPoint, EntityLearningTopic, EntityLearningTopicExample } from '../services';
import { getSignalCatalogEntry } from '../signals-data';
import type { SelectedEntity } from '../types';

export const SignalTraceDetailsPanel = TopicTraceDetailsPanel;
const SignalsLayout = TopicsLayout;

type SignalTab = 'trace-list' | 'chart';

function clusterColor(topicId: string) {
  let hash = 0;
  for (let i = 0; i < topicId.length; i++) {
    hash = topicId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  // Multiply by the golden-angle so close ids (e.g. "1","2","3") map to well-separated hues.
  const hue = Math.abs(hash * 137.508) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

interface SignalClusterSidebarProps {
  topics: EntityLearningTopic[];
  selectedTopicIds: string[];
  onTopicSelect: (topicId: string) => void;
  multiple?: boolean;
  ariaLabel?: string;
}

export function SignalClusterSidebar({
  topics,
  selectedTopicIds,
  onTopicSelect,
  multiple = false,
  ariaLabel = 'Signal clusters',
}: SignalClusterSidebarProps) {
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
                    style={{ backgroundColor: clusterColor(topic.topicId) }}
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

function SignalTraceListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-1 px-2 py-1" aria-label="Loading traces" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}

function SignalClusterSidebarSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <aside className="min-h-0 w-72 shrink-0 overflow-y-auto border-r border-border1/60 pr-4 py-4" aria-hidden="true">
      <ul className="space-y-1">
        {Array.from({ length: rows }).map((_, index) => (
          <li key={index} className="flex items-start gap-2 px-3 py-2">
            <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SignalDetailsSkeleton() {
  return (
    <section className="flex h-full min-w-0 flex-col gap-4" aria-label="Loading signal" aria-busy="true">
      <header className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </header>
      <div className="flex gap-6 border-b border-border1/60">
        <Skeleton className="mb-2 h-5 w-20" />
        <Skeleton className="mb-2 h-5 w-16" />
      </div>
      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden">
        <SignalClusterSidebarSkeleton />
        <div className="min-w-0 flex-1 space-y-4 py-4">
          <Skeleton className="h-9 w-full rounded-lg" />
          <SignalTraceListSkeleton />
        </div>
      </div>
    </section>
  );
}

export function SignalTraceListTab({
  examples,
  selectedTraceId,
  onTraceSelect,
  loading = false,
  pageSize = 25,
}: {
  examples: EntityLearningTopicExample[];
  selectedTraceId: string | null;
  onTraceSelect: (traceId: string) => void;
  loading?: boolean;
  pageSize?: number;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return examples;
    return examples.filter(example => example.signalText.toLowerCase().includes(query));
  }, [examples, search]);

  const visible = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page, pageSize]);
  const hasMore = visible.length < filtered.length;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Topic trace summaries">
      <Searchbar
        label="Search traces"
        placeholder="Search traces"
        onSearch={value => {
          setSearch(value);
          setPage(1);
        }}
      />

      <DataList
        columns="minmax(12rem,1fr)"
        className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border1/60"
      >
        <DataList.Top>
          <DataList.TopCells>
            <DataList.TopCell>Trace summary</DataList.TopCell>
          </DataList.TopCells>
        </DataList.Top>

        {loading ? (
          <SignalTraceListSkeleton />
        ) : visible.length === 0 ? (
          <DataList.NoMatch message="No traces match this subtopic." />
        ) : (
          visible.map(example => (
            <DataList.RowButton
              key={example.exampleId}
              featured={selectedTraceId === example.traceId}
              onClick={() => onTraceSelect(example.traceId)}
              aria-pressed={selectedTraceId === example.traceId}
            >
              <DataList.TextCell>{example.signalText}</DataList.TextCell>
            </DataList.RowButton>
          ))
        )}
      </DataList>

      {hasMore && !loading ? (
        <Button variant="outline" size="sm" onClick={() => setPage(currentPage => currentPage + 1)}>
          Load more traces ({visible.length} of {filtered.length})
        </Button>
      ) : null}
    </section>
  );
}

interface SignalChartTabProps {
  topics: EntityLearningTopic[];
  points: EntityLearningPoint[];
  selectedTopicIds: string[];
  onTopicToggle: (topicId: string) => void;
}

export function SignalChartTab({ topics, points, selectedTopicIds, onTopicToggle }: SignalChartTabProps) {
  const chartData = useMemo(
    () =>
      points
        // Only show points belonging to a selected cluster.
        .filter(
          (point): point is EntityLearningPoint & { topicId: string } =>
            point.topicId !== undefined && selectedTopicIds.includes(point.topicId),
        )
        .map(point => ({ ...point, color: clusterColor(point.topicId) })),
    [points, selectedTopicIds],
  );

  return (
    <div className="flex h-full min-w-0 gap-6">
      <SignalClusterSidebar
        topics={topics}
        selectedTopicIds={selectedTopicIds}
        onTopicSelect={onTopicToggle}
        multiple
        ariaLabel="Chart cluster filters"
      />
      <div className="min-h-0 min-w-0 flex-1 py-4">
        <ScatterPlotChart
          data={chartData}
          xKey="x"
          yKey="y"
          nameKey="topicId"
          colorKey="color"
          height="100%"
          className="h-full"
          xLabel="X"
          yLabel="Y"
        />
      </div>
    </div>
  );
}

interface SignalClusterTabsProps {
  topics: EntityLearningTopic[];
  examples: EntityLearningTopicExample[];
  examplesLoading: boolean;
  points: EntityLearningPoint[];
  selectedTopicId: string;
  selectedTraceId: string | null;
  selectedChartTopicIds: string[];
  activeTab: SignalTab;
  onActiveTabChange: (tab: SignalTab) => void;
  onTopicSelect: (topicId: string) => void;
  onChartTopicToggle: (topicId: string) => void;
  onTraceSelect: (traceId: string) => void;
}

export function SignalClusterTabs({
  topics,
  examples,
  examplesLoading,
  points,
  selectedTopicId,
  selectedTraceId,
  selectedChartTopicIds,
  activeTab,
  onActiveTabChange,
  onTopicSelect,
  onChartTopicToggle,
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
          <SignalClusterSidebar topics={topics} selectedTopicIds={[selectedTopicId]} onTopicSelect={onTopicSelect} />
          <div className="min-w-0 flex-1 overflow-hidden py-4">
            <SignalTraceListTab
              examples={examples}
              loading={examplesLoading}
              selectedTraceId={selectedTraceId}
              onTraceSelect={onTraceSelect}
            />
          </div>
        </div>
      </TabContent>
      <TabContent value="chart" className="min-h-0 flex-1 overflow-hidden py-0">
        <SignalChartTab
          topics={topics}
          points={points}
          selectedTopicIds={selectedChartTopicIds}
          onTopicToggle={onChartTopicToggle}
        />
      </TabContent>
    </Tabs>
  );
}

export interface SignalDetailsPageProps {
  signalId?: string;
  entity: SelectedEntity | null;
  selectedTraceId: string | null;
  initialTopicId?: string | null;
  tracePanel?: ReactNode;
  onTraceSelect: (signalId: string, traceId: string) => void;
}

export function SignalDetailsPage({
  signalId,
  entity,
  selectedTraceId,
  initialTopicId,
  tracePanel,
  onTraceSelect,
}: SignalDetailsPageProps) {
  const { data: entities = [], isLoading: entitiesLoading, isError: entitiesError } = useEntities();
  const resolvedEntity = entities.find(item => item.entityId === entity?.entityId);

  // No runId: the API resolves the latest run for this signal (the entity-wide
  // `latestRunId` belongs to a single signal). Examples/points below reuse the
  // run resolved by the topics response so all three queries hit the same run.
  const {
    data: topicsData,
    isLoading: topicsLoading,
    isError: topicsError,
  } = useEntityTopics(resolvedEntity?.entityId, signalId);
  const topics: EntityLearningTopic[] = useMemo(() => topicsData?.topics ?? [], [topicsData]);
  const runId = topicsData?.run?.runId;

  const topicSelectionScope = `${signalId ?? ''}:${entity?.entityId ?? ''}:${runId ?? ''}:${initialTopicId ?? ''}`;
  const chartSelectionScope = `${signalId ?? ''}:${entity?.entityId ?? ''}:${runId ?? ''}`;
  const topicIds = useMemo(() => topics.map(topic => topic.topicId), [topics]);
  const topicIdSet = useMemo(() => new Set(topicIds), [topicIds]);
  const [selectedTopic, setSelectedTopic] = useState<{ scope: string; topicId: string | null }>(() => ({
    scope: topicSelectionScope,
    topicId: initialTopicId ?? null,
  }));
  const [selectedChartTopics, setSelectedChartTopics] = useState<{ scope: string; topicIds: string[] | null }>(() => ({
    scope: chartSelectionScope,
    topicIds: null,
  }));
  const [activeTab, setActiveTab] = useState<SignalTab>('trace-list');

  const requestedTopicId =
    selectedTopic.scope === topicSelectionScope ? selectedTopic.topicId : (initialTopicId ?? null);
  const resolvedTopicId = requestedTopicId && topicIdSet.has(requestedTopicId) ? requestedTopicId : topics[0]?.topicId;
  const selectedTopicData = topics.find(topic => topic.topicId === resolvedTopicId);
  const examplesEnabled = Boolean(resolvedEntity?.entityId && signalId && runId && selectedTopicData);
  const pointsEnabled = Boolean(resolvedEntity?.entityId && signalId && runId);
  const chartTopicIds =
    selectedChartTopics.scope === chartSelectionScope && selectedChartTopics.topicIds
      ? selectedChartTopics.topicIds.filter(topicId => topicIdSet.has(topicId))
      : topicIds;

  const {
    data: examplesData,
    isLoading: examplesLoading,
    isFetching: examplesFetching,
    isError: examplesError,
  } = useEntityTopicExamples(
    resolvedEntity?.entityId,
    selectedTopicData?.topicId,
    examplesEnabled && runId && signalId ? { signalName: signalId, runId } : undefined,
  );
  const examples: EntityLearningTopicExample[] = examplesData?.examples ?? [];
  // Show the skeleton on the first load and while switching topics refetches,
  // so the trace list never flashes the empty-state copy between datasets.
  const examplesPending = examplesLoading || (examplesFetching && examplesData === undefined);

  const { data: pointsData, isError: pointsError } = useEntityPoints(
    resolvedEntity?.entityId,
    pointsEnabled && runId && signalId ? { signalName: signalId, runId, includeOutliers: true } : undefined,
  );
  const points: EntityLearningPoint[] = pointsData?.points ?? [];

  const handleTraceSelect = (traceId: string) => {
    if (!signalId) return;
    onTraceSelect(signalId, traceId);
  };

  const handleTopicSelect = (topicId: string) => {
    setSelectedTopic({ scope: topicSelectionScope, topicId });
  };

  const handleChartTopicToggle = (topicId: string) => {
    setSelectedChartTopics(current => {
      const base = current.scope === chartSelectionScope && current.topicIds ? current.topicIds : topicIds;
      return {
        scope: chartSelectionScope,
        topicIds: base.includes(topicId) ? base.filter(id => id !== topicId) : [...base, topicId],
      };
    });
  };

  if (entitiesLoading || topicsLoading) {
    return (
      <SignalsLayout sidebar={null}>
        <SignalDetailsSkeleton />
      </SignalsLayout>
    );
  }

  if (entitiesError || topicsError || (examplesEnabled && examplesError) || (pointsEnabled && pointsError)) {
    return (
      <SignalsLayout sidebar={null}>
        <p className="text-ui-md text-accent2">Failed to load this signal from the observability endpoint.</p>
      </SignalsLayout>
    );
  }

  if (!resolvedEntity || !selectedTopicData) {
    return <SignalsLayout sidebar={null}>Signal not found</SignalsLayout>;
  }

  const signalName = getSignalCatalogEntry(signalId ?? '').name;

  return (
    <SignalsLayout sidebar={null} tracePanel={activeTab === 'trace-list' ? tracePanel : undefined}>
      <section className="flex h-full min-w-0 flex-col gap-4">
        <header className="space-y-1">
          <h1 className="text-icon-xl font-semibold text-neutral6">{signalName}</h1>
          <p className="text-ui-sm text-neutral3">Explore trace patterns by cluster.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SignalClusterTabs
            topics={topics}
            examples={examples}
            examplesLoading={examplesPending}
            points={points}
            selectedTopicId={selectedTopicData.topicId}
            selectedTraceId={selectedTraceId}
            selectedChartTopicIds={chartTopicIds}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            onTopicSelect={handleTopicSelect}
            onChartTopicToggle={handleChartTopicToggle}
            onTraceSelect={handleTraceSelect}
          />
        </div>
      </section>
    </SignalsLayout>
  );
}
