import { SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../ds/components/Button';
import { DataList } from '../../../ds/components/DataList/data-list';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../../ds/components/InputGroup';
import { Skeleton } from '../../../ds/components/Skeleton';
import { cn } from '../../../lib/utils';
import { TopicTraceDetailsPanel, TopicsLayout } from '../../topics';
import { useEntities, useEntityTopicExamples, useEntityTopics } from '../hooks';
import type { EntityLearningTopic, EntityLearningTopicExample } from '../services';
import { getSignalCatalogEntry } from '../signals-data';
import type { SelectedEntity } from '../types';

export const SignalTraceDetailsPanel = TopicTraceDetailsPanel;
const SignalsLayout = TopicsLayout;

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
    <section
      className="grid grid-rows-[auto_1fr] min-h-0 gap-4 h-full overflow-y-auto"
      aria-label="Topic trace summaries"
    >
      <InputGroup variant="outline">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Search traces"
          placeholder="Search traces"
          onChange={event => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </InputGroup>

      <DataList
        columns="minmax(12rem,1fr)"
        className="min-h-0 h-full overflow-y-auto rounded-lg border border-border1/60"
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

interface SignalClusterTraceListProps {
  topics: EntityLearningTopic[];
  examples: EntityLearningTopicExample[];
  examplesLoading: boolean;
  selectedTopicId: string;
  selectedTraceId: string | null;
  onTopicSelect: (topicId: string) => void;
  onTraceSelect: (traceId: string) => void;
}

export function SignalClusterTraceList({
  topics,
  examples,
  examplesLoading,
  selectedTopicId,
  selectedTraceId,
  onTopicSelect,
  onTraceSelect,
}: SignalClusterTraceListProps) {
  return (
    <div className="flex h-full min-w-0 gap-6 overflow-y-auto">
      <SignalClusterSidebar topics={topics} selectedTopicIds={[selectedTopicId]} onTopicSelect={onTopicSelect} />
      <div className="min-w-0 flex-1 overflow-y-auto h-full py-4">
        <SignalTraceListTab
          examples={examples}
          loading={examplesLoading}
          selectedTraceId={selectedTraceId}
          onTraceSelect={onTraceSelect}
        />
      </div>
    </div>
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
  // `latestRunId` belongs to a single signal). Examples below reuse the run
  // resolved by the topics response.
  const {
    data: topicsData,
    isLoading: topicsLoading,
    isError: topicsError,
  } = useEntityTopics(resolvedEntity?.entityId, signalId);
  const topics = useMemo<EntityLearningTopic[]>(() => topicsData?.topics ?? [], [topicsData?.topics]);
  const runId = topicsData?.run?.runId;

  const topicSelectionScope = `${signalId ?? ''}:${entity?.entityId ?? ''}:${runId ?? ''}:${initialTopicId ?? ''}`;
  const topicIds = useMemo(() => topics.map(topic => topic.topicId), [topics]);
  const topicIdSet = useMemo(() => new Set(topicIds), [topicIds]);
  const [selectedTopic, setSelectedTopic] = useState<{ scope: string; topicId: string | null }>(() => ({
    scope: topicSelectionScope,
    topicId: initialTopicId ?? null,
  }));

  const requestedTopicId =
    selectedTopic.scope === topicSelectionScope ? selectedTopic.topicId : (initialTopicId ?? null);
  const resolvedTopicId = requestedTopicId && topicIdSet.has(requestedTopicId) ? requestedTopicId : topics[0]?.topicId;
  const selectedTopicData = topics.find(topic => topic.topicId === resolvedTopicId);
  const examplesEnabled = Boolean(resolvedEntity?.entityId && signalId && runId && selectedTopicData);
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

  const handleTraceSelect = (traceId: string) => {
    if (!signalId) return;
    onTraceSelect(signalId, traceId);
  };

  const handleTopicSelect = (topicId: string) => {
    setSelectedTopic({ scope: topicSelectionScope, topicId });
  };

  if (entitiesLoading || topicsLoading) {
    return (
      <SignalsLayout sidebar={null}>
        <SignalDetailsSkeleton />
      </SignalsLayout>
    );
  }

  if (entitiesError || topicsError || (examplesEnabled && examplesError)) {
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
    <SignalsLayout sidebar={null} tracePanel={tracePanel}>
      <section className="flex h-full min-w-0 flex-col gap-4">
        <header className="space-y-1">
          <h1 className="text-icon-xl font-semibold text-neutral6">{signalName}</h1>
          <p className="text-ui-sm text-neutral3">Explore trace patterns by cluster.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SignalClusterTraceList
            topics={topics}
            examples={examples}
            examplesLoading={examplesPending}
            selectedTopicId={selectedTopicData.topicId}
            selectedTraceId={selectedTraceId}
            onTopicSelect={handleTopicSelect}
            onTraceSelect={handleTraceSelect}
          />
        </div>
      </section>
    </SignalsLayout>
  );
}
