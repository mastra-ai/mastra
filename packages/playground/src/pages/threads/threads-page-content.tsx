import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { ThreadsFilterBar } from '@mastra/playground-ui/domains/threads/components/threads-filter-bar';
import { buildThreadQueryWhere } from '@mastra/playground-ui/domains/threads/thread-filters';
import { NoTracesInfo } from '@mastra/playground-ui/domains/traces/components/no-traces-info';
import { TraceThreadPanel } from '@mastra/playground-ui/domains/traces/components/trace-thread-panel';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import {
  DEFAULT_TRACES_FILTERS,
  resolveTracesDateWindow,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import type { TracesListViewTrace } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { TracesSpansSwitch } from '@mastra/playground-ui/domains/traces/components/traces-spans-switch';
import type { ObservabilityView } from '@mastra/playground-ui/domains/traces/components/traces-spans-switch';
import { recoveryRefetchInterval } from '@mastra/playground-ui/domains/traces/hooks/use-traces-list-source';
import { resolveTraceQueryTimeRange } from '@mastra/playground-ui/domains/traces/trace-query-filters';
import type { TraceFilterGroup, TraceFilterToken } from '@mastra/playground-ui/domains/traces/trace-query-filters';
import type { TraceDatePreset } from '@mastra/playground-ui/domains/traces/types';
import { useFeedbackAvailable, useSpanQueryAvailable, useTraceQueryAvailable } from '@mastra/react/hooks/capabilities';
import { useQueryThreads } from '@mastra/react/hooks/traces';
import type { ThreadQueryArgs, ThreadRow } from '@mastra/react/hooks/traces';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { STUDIO_TRACES_FEATURES } from '../traces/features';
import { tracesCrumbs } from './crumbs';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { traceScoreLink } from '@/lib/app-routing';

// Same window as /traces, so switching between the pages keeps the time chip identical.
const DEFAULT_DATE_PRESET: TraceDatePreset = DEFAULT_TRACES_FILTERS.datePreset;

// A thread spans several traces; its latest one keys the row, since it is unique per thread.
function toListRow(thread: ThreadRow): TracesListViewTrace {
  return {
    traceId: thread.lastTraceId,
    name: thread.entityName ?? thread.threadId,
    entityType: thread.entityType,
    entityId: thread.entityId,
    entityName: thread.entityName,
    threadId: thread.threadId,
    resourceId: thread.resourceId,
    environment: thread.environment,
    status: thread.status,
    inputPreview: thread.inputPreview,
    outputPreview: thread.outputPreview ?? undefined,
    errorPreview: thread.errorPreview ?? undefined,
    startedAt: thread.startedAt,
    endedAt: thread.endedAt,
    createdAt: thread.startedAt,
  };
}

type DateState = { datePreset: TraceDatePreset; dateFrom?: Date; dateTo?: Date };

export function ThreadsPageContent() {
  const navigate = useNavigate();
  // The open thread lives in the URL, so it survives a reload and can be shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedThreadId = searchParams.get('threadId');
  const setSelectedThreadId = (threadId: string | undefined) =>
    setSearchParams(
      current => {
        const params = new URLSearchParams(current);
        if (threadId) params.set('threadId', threadId);
        else params.delete('threadId');
        return params;
      },
      { replace: true },
    );
  const [dates, setDates] = useState<DateState>({ datePreset: DEFAULT_DATE_PRESET });
  const [tokens, setTokens] = useState<TraceFilterToken[]>([]);
  const [groups, setGroups] = useState<TraceFilterGroup[]>([]);
  const [sort, setSort] = useState<DataListSort>('desc');

  const withSpanQuery = useSpanQueryAvailable().enabled && STUDIO_TRACES_FEATURES.spanQuery;
  const views: ObservabilityView[] = withSpanQuery ? ['traces', 'spans', 'threads'] : ['traces', 'threads'];
  const withQueryTrace = useTraceQueryAvailable().enabled;
  const withFeedback = useFeedbackAvailable().enabled;

  const { datePreset, dateFrom, dateTo } = dates;
  const fromMs = dateFrom?.getTime();
  const toMs = dateTo?.getTime();
  // Rolling presets are resolved against "now" only when the range changes, so the query key
  // (and the cursors issued for it) stays stable while the list scrolls.
  const timeRange = useMemo(() => {
    const window = resolveTracesDateWindow(
      datePreset,
      fromMs === undefined ? undefined : new Date(fromMs),
      toMs === undefined ? undefined : new Date(toMs),
    );
    return resolveTraceQueryTimeRange(window.dateFrom, window.dateTo, new Date());
  }, [datePreset, fromMs, toMs]);

  // Threads with trace activity in the window, like the traces list for the same chip.
  const query = useMemo<ThreadQueryArgs>(() => {
    const where = buildThreadQueryWhere(tokens, groups);
    return {
      timeRange: { traces: timeRange },
      orderBy: [{ field: 'startedAt', direction: sort }],
      ...(where ? { where } : {}),
    };
  }, [timeRange, sort, tokens, groups]);

  // Like /spans: a timer or a window focus would reload every loaded page and reset the cursor
  // chain, so the list only reloads to recover from a transient failure.
  const { threads, hasNextPage, isFetchingNextPage, setEndOfListElement, isLoading, isError, error } = useQueryThreads({
    query,
    queryOptions: {
      refetchInterval: ({ state }) => recoveryRefetchInterval(state.error),
      refetchOnWindowFocus: false,
    },
  });

  // Switching to `custom` keeps the current dates so the picker opens on them; any other preset drops them.
  const handleDatePresetChange = (preset: TraceDatePreset) =>
    setDates(current => (preset === 'custom' ? { ...current, datePreset: preset } : { datePreset: preset }));
  // The picker can report a date right after switching away from `custom`; those are ignored.
  const handleDateChange = (date: Date | undefined, end: 'from' | 'to') =>
    setDates(current => {
      if (current.datePreset !== 'custom') return current;
      return end === 'from' ? { ...current, dateFrom: date } : { ...current, dateTo: date };
    });
  const handleDateRangeChange = (from: Date | undefined, to: Date | undefined) =>
    setDates(current => (current.datePreset === 'custom' ? { ...current, dateFrom: from, dateTo: to } : current));
  const handleFiltersChange = (nextTokens: TraceFilterToken[], nextGroups: TraceFilterGroup[]) => {
    setTokens(nextTokens);
    setGroups(nextGroups);
  };

  const rows = useMemo(() => (threads ?? []).map(toListRow), [threads]);
  const selectedRow = rows.find(row => row.threadId === selectedThreadId);

  // The drawer is modal, so the list behind it cannot be clicked while a thread is open.
  const handleThreadClick = (row: TracesListViewTrace) => {
    if (row.threadId) setSelectedThreadId(row.threadId);
  };
  const closePanel = () => setSelectedThreadId(undefined);

  const contentFiltersApplied = tokens.length > 0 || groups.length > 0;
  const filtersApplied = contentFiltersApplied || datePreset !== DEFAULT_DATE_PRESET;
  // Same rule as /traces: an empty window without filters gets the full-page empty state.
  const showEmptyState = !isLoading && !isError && rows.length === 0 && !contentFiltersApplied && !selectedThreadId;

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={tracesCrumbs} />}
      actionRow={<TracesSpansSwitch current="threads" views={views} onViewChange={view => navigate(`/${view}`)} />}
    >
      <h1 className="sr-only">Threads</h1>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <ActionRow>
          <ActionRow.Start>
            <ThreadsFilterBar
              datePreset={datePreset}
              dateFrom={dateFrom}
              dateTo={dateTo}
              tokens={tokens}
              groups={groups}
              onDatePresetChange={handleDatePresetChange}
              onDateChange={handleDateChange}
              onDateRangeChange={handleDateRangeChange}
              onFiltersChange={handleFiltersChange}
              disabled={isLoading}
            />
          </ActionRow.Start>
        </ActionRow>
        <div className="min-h-0 flex-1">
          {isError ? (
            <div className="flex h-full items-center justify-center">
              <TracesErrorContent error={error} resource="threads" errorTitle="Failed to load threads" />
            </div>
          ) : showEmptyState ? (
            <NoTracesInfo resource="threads" datePreset={datePreset} dateFrom={dateFrom} dateTo={dateTo} />
          ) : (
            <TracesListView
              listId="all-threads"
              traces={rows}
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              setEndOfListElement={setEndOfListElement}
              filtersApplied={filtersApplied}
              resource="threads"
              createdSort={sort}
              onSortChange={setSort}
              featuredTraceId={selectedRow?.traceId}
              onTraceClick={handleThreadClick}
            />
          )}
        </div>
      </div>
      <TraceThreadPanel
        open={!!selectedThreadId}
        threadId={selectedThreadId ?? ''}
        depth={1}
        closeLabel="Close"
        withQueryTrace={withQueryTrace}
        withFeedback={withFeedback}
        onOpenScore={(traceId, scoreId) => navigate(traceScoreLink(traceId, scoreId))}
        onClose={closePanel}
      />
    </PageLayout>
  );
}
