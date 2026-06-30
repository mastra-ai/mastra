import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../ds/components/Button';
import { DataList } from '../../../ds/components/DataList/data-list';
import { ScatterPlotChart } from '../../../ds/components/ScatterPlotChart';
import { Searchbar } from '../../../ds/components/Searchbar';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import { cn } from '../../../lib/utils';
import { TopicTraceDetailsPanel, TopicsLayout } from '../../topics';
import { useEntities, useEntityPoints, useEntityTopicExamples, useEntityTopics } from '../hooks';
import { getSignalCatalogEntry } from '../signals-data';
import type { EntityLearningPoint, EntityLearningTopic, EntityLearningTopicExample, SelectedEntity } from '../types';

export const SignalTraceDetailsPanel = TopicTraceDetailsPanel;
const SignalsLayout = TopicsLayout;

type SignalTab = 'trace-list' | 'chart';

const OUTLIER_COLOR = 'hsl(0, 0%, 55%)';

function clusterColor(topicId: string | undefined) {
  if (!topicId) return OUTLIER_COLOR;
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

export function SignalTraceListTab({
  examples,
  selectedTraceId,
  onTraceSelect,
  pageSize = 25,
}: {
  examples: EntityLearningTopicExample[];
  selectedTraceId: string | null;
  onTraceSelect: (traceId: string) => void;
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

      <DataList columns="minmax(12rem,1fr)" className="min-h-0 flex-1">
        <DataList.Top>
          <DataList.TopCells>
            <DataList.TopCell>Trace summary</DataList.TopCell>
          </DataList.TopCells>
        </DataList.Top>

        {visible.length === 0 ? (
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

      {hasMore ? (
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
        .filter(point => point.topicId !== undefined && selectedTopicIds.includes(point.topicId))
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
            <SignalTraceListTab examples={examples} selectedTraceId={selectedTraceId} onTraceSelect={onTraceSelect} />
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
  tracePanel?: ReactNode;
  onTraceSelect: (signalId: string, traceId: string) => void;
}

export function SignalDetailsPage({
  signalId,
  entity,
  selectedTraceId,
  tracePanel,
  onTraceSelect,
}: SignalDetailsPageProps) {
  const { data: entities = [], isLoading: entitiesLoading, isError: entitiesError } = useEntities();
  const resolvedEntity = entities.find(item => item.entityId === entity?.entityId);
  const runId = resolvedEntity?.latestRunId;

  const {
    data: topicsData,
    isLoading: topicsLoading,
    isError: topicsError,
  } = useEntityTopics(resolvedEntity?.entityId, signalId, runId);
  const topics: EntityLearningTopic[] = topicsData?.topics ?? [];

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedChartTopicIds, setSelectedChartTopicIds] = useState<string[] | null>(null);
  const [activeTab, setActiveTab] = useState<SignalTab>('trace-list');

  const selectedTopic = topics.find(topic => topic.topicId === selectedTopicId) ?? topics[0];
  const chartTopicIds = selectedChartTopicIds ?? topics.map(topic => topic.topicId);

  const { data: examplesData } = useEntityTopicExamples(
    resolvedEntity?.entityId,
    selectedTopic?.topicId,
    runId && signalId ? { signalName: signalId, runId } : undefined,
  );
  const examples: EntityLearningTopicExample[] = examplesData?.examples ?? [];

  const { data: pointsData } = useEntityPoints(
    resolvedEntity?.entityId,
    runId && signalId ? { signalName: signalId, runId, includeOutliers: true } : undefined,
  );
  const points: EntityLearningPoint[] = pointsData?.points ?? [];

  const handleTraceSelect = (traceId: string) => {
    if (!signalId) return;
    onTraceSelect(signalId, traceId);
  };

  const handleChartTopicToggle = (topicId: string) => {
    setSelectedChartTopicIds(current => {
      const base = current ?? topics.map(topic => topic.topicId);
      return base.includes(topicId) ? base.filter(id => id !== topicId) : [...base, topicId];
    });
  };

  if (entitiesLoading || topicsLoading) {
    return (
      <SignalsLayout sidebar={null}>
        <p className="text-ui-md text-neutral3">Loading signal…</p>
      </SignalsLayout>
    );
  }

  if (entitiesError || topicsError) {
    return (
      <SignalsLayout sidebar={null}>
        <p className="text-ui-md text-accent2">Failed to load this signal from the observability endpoint.</p>
      </SignalsLayout>
    );
  }

  if (!resolvedEntity || !selectedTopic) {
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
            points={points}
            selectedTopicId={selectedTopic.topicId}
            selectedTraceId={selectedTraceId}
            selectedChartTopicIds={chartTopicIds}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            onTopicSelect={setSelectedTopicId}
            onChartTopicToggle={handleChartTopicToggle}
            onTraceSelect={handleTraceSelect}
          />
        </div>
      </section>
    </SignalsLayout>
  );
}
