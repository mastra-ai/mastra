import { EntityType } from '@mastra/core/observability';
import {
  ButtonWithTooltip,
  DateTimeRangePicker,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PropertyFilterCreator,
  SpanDataPanelView,
  TraceDataPanelView,
  TracesErrorContent,
  TracesLayout,
  TracesListView,
  TracesToolbar,
  buildTraceListFilters,
  createTracePropertyFilterFields,
  neutralizeFilterTokens,
  useEntityNames,
  useEnvironments,
  useServiceNames,
  useSpanDetail,
  useTags,
  useTraceFilterPersistence,
  useTraceLightSpans,
  useTraceListNavigation,
  useTraceSpanNavigation,
  useTraceUrlState,
  useTraces,
} from '@mastra/playground-ui';
import type { SpanTab } from '@mastra/playground-ui';
import { BookIcon, EyeIcon, ListIcon, ListTreeIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { useScorers } from '@/domains/scores';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';
import { SpanFeedbackList } from '@/domains/traces/components/span-feedback-list';
import { SpanScoresList } from '@/domains/traces/components/span-scores-list';
import { SpanScoring } from '@/domains/traces/components/span-scoring';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
import { Link } from '@/lib/link';

export default function TracesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupByThread, setGroupByThread] = useState<boolean>(false);
  const url = useTraceUrlState(searchParams, setSearchParams, {
    onRemoveAll: () => setGroupByThread(false),
  });

  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();
  const [spanScoresPage, setSpanScoresPage] = useState(0);
  const [traceCollapsed, setTraceCollapsed] = useState(false);
  const [datasetDialogTarget, setDatasetDialogTarget] = useState<{
    traceId: string;
    rootSpanId: string | undefined;
  } | null>(null);

  // Reset pagination whenever the selected trace or span changes — otherwise a page index from a
  // previous span could be reused against a span that has fewer (or no) scores.
  useEffect(() => setSpanScoresPage(0), [url.traceIdParam, url.spanIdParam]);

  const { data: scorers, isLoading: isLoadingScorers } = useScorers();
  const { data: spanScoresData, isLoading: isLoadingSpanScoresData } = useTraceSpanScores({
    traceId: url.traceIdParam,
    spanId: url.spanIdParam,
    page: spanScoresPage,
  });

  const [feedbackPage, setFeedbackPage] = useState(0);
  useEffect(() => setFeedbackPage(0), [url.traceIdParam, url.spanIdParam]);
  const { data: feedbackData, isLoading: isLoadingFeedback } = useTraceFeedback({
    traceId: url.traceIdParam,
    page: feedbackPage,
  });

  // Trace + span detail fetched at the page level (was inside the old smart components).
  const { data: lightSpansData, isLoading: isLoadingLightSpans } = useTraceLightSpans(url.traceIdParam ?? null);
  const lightSpans = useMemo(() => lightSpansData?.spans, [lightSpansData?.spans]);
  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail(
    url.traceIdParam ?? '',
    url.spanIdParam ?? '',
  );

  // Derived from URL + query data — no local state, so a span change (which clears scoreIdParam
  // in the URL) or a direct URL edit always resyncs ScoreDataPanel.
  const featuredScore = url.scoreIdParam ? spanScoresData?.scores?.find(s => s.id === url.scoreIdParam) : undefined;

  const { data: availableTags = [], isPending: isTagsLoading } = useTags();
  const { data: rootEntityNameSuggestions = [], isPending: isEntityNamesLoading } = useEntityNames({
    entityType: url.selectedEntityOption?.entityType,
    rootOnly: true,
  });
  const { data: discoveredEnvironments = [], isPending: isEnvironmentsLoading } = useEnvironments();
  const { data: discoveredServiceNames = [], isPending: isServiceNamesLoading } = useServiceNames();

  const filterFields = useMemo(
    () =>
      createTracePropertyFilterFields({
        availableTags,
        availableRootEntityNames: rootEntityNameSuggestions,
        availableServiceNames: discoveredServiceNames,
        availableEnvironments: discoveredEnvironments,
        loading: {
          tags: isTagsLoading,
          entityNames: isEntityNamesLoading,
          serviceNames: isServiceNamesLoading,
          environments: isEnvironmentsLoading,
        },
      }),
    [
      availableTags,
      rootEntityNameSuggestions,
      discoveredServiceNames,
      discoveredEnvironments,
      isTagsLoading,
      isEntityNamesLoading,
      isServiceNamesLoading,
      isEnvironmentsLoading,
    ],
  );

  const traceFilters = useMemo(
    () =>
      buildTraceListFilters({
        rootEntityType: url.selectedEntityOption?.entityType,
        status: url.selectedStatus,
        dateFrom: url.selectedDateFrom,
        dateTo: url.selectedDateTo,
        tokens: url.filterTokens,
      }),
    [url.filterTokens, url.selectedDateFrom, url.selectedDateTo, url.selectedEntityOption, url.selectedStatus],
  );

  const {
    data: tracesData,
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: tracesError,
  } = useTraces({ filters: traceFilters });

  const traces = useMemo(() => tracesData?.spans ?? [], [tracesData?.spans]);
  const threadTitles = tracesData?.threadTitles ?? {};

  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(lightSpans, url.spanIdParam ?? null, id =>
    url.handleSpanChange(id),
  );

  const persistence = useTraceFilterPersistence(searchParams, setSearchParams);

  const handleClear = useCallback(
    () => url.applyFilterTokens(neutralizeFilterTokens(filterFields, url.filterTokens)),
    [filterFields, url],
  );

  const { handlePreviousTrace, handleNextTrace } = useTraceListNavigation(
    traces,
    url.traceIdParam,
    url.handleTraceClick,
  );

  // "Evaluate Trace" jumps to the root span and switches to the scoring tab.
  const handleEvaluateTrace = useCallback(() => {
    const rootSpan = lightSpans?.find(s => s.parentSpanId == null);
    if (!rootSpan) return;
    url.handleSpanChange(rootSpan.spanId);
    url.handleSpanTabChange('scoring');
  }, [lightSpans, url]);

  if (tracesError) {
    return (
      <NoDataPageLayout title="Traces" icon={<EyeIcon />}>
        <TracesErrorContent error={tracesError} resource="traces" errorTitle="Failed to load traces" />
      </NoDataPageLayout>
    );
  }

  const filtersApplied =
    !!url.selectedEntityOption ||
    !!url.selectedStatus ||
    url.filterTokens.length > 0 ||
    url.datePreset !== 'last-24h' ||
    !!url.selectedDateTo;

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isTracesLoading}>
                <EyeIcon /> Traces
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end items-center gap-2">
            <DateTimeRangePicker
              preset={url.datePreset}
              onPresetChange={url.handleDatePresetChange}
              dateFrom={url.selectedDateFrom}
              dateTo={url.selectedDateTo}
              onDateChange={url.handleDateChange}
              disabled={isTracesLoading}
              presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
            />
            <PropertyFilterCreator
              fields={filterFields}
              tokens={url.filterTokens}
              onTokensChange={url.handleFilterTokensChange}
              disabled={isTracesLoading}
              onStartTextFilter={setAutoFocusFilterFieldId}
            />
            <ButtonWithTooltip
              disabled={isTracesLoading}
              aria-pressed={groupByThread}
              aria-label={groupByThread ? 'Ungroup traces' : 'Group traces by thread'}
              tooltipContent={groupByThread ? 'Ungroup traces' : 'Group traces by thread'}
              onClick={() => setGroupByThread(prev => !prev)}
            >
              {groupByThread ? <ListIcon /> : <ListTreeIcon />}
            </ButtonWithTooltip>
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Traces documentation"
              tooltipContent="Go to Traces documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>

        <TracesToolbar
          isLoading={isTracesLoading}
          filterFields={filterFields}
          filterTokens={url.filterTokens}
          onFilterTokensChange={url.handleFilterTokensChange}
          onClear={handleClear}
          onRemoveAll={url.handleRemoveAll}
          onSave={persistence.handleSave}
          onRemoveSaved={persistence.hasSavedFilters ? persistence.handleRemoveSaved : undefined}
          autoFocusFilterFieldId={autoFocusFilterFieldId}
        />
      </PageLayout.TopArea>

      <TracesLayout
        traceCollapsed={traceCollapsed}
        listSlot={
          <TracesListView
            traces={traces}
            isLoading={isTracesLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            setEndOfListElement={setEndOfListElement}
            filtersApplied={filtersApplied}
            featuredTraceId={url.traceIdParam}
            onTraceClick={trace => url.handleTraceClick(url.traceIdParam === trace.traceId ? '' : trace.traceId)}
            groupByThread={groupByThread}
            threadTitles={threadTitles}
          />
        }
        tracePanelSlot={
          url.traceIdParam ? (
            <TraceDataPanelView
              traceId={url.traceIdParam}
              spans={lightSpans}
              isLoading={isLoadingLightSpans}
              onClose={url.handleTraceClose}
              onSpanSelect={id => url.handleSpanChange(id ?? null)}
              onEvaluateTrace={handleEvaluateTrace}
              onSaveAsDatasetItem={args => setDatasetDialogTarget(args)}
              initialSpanId={url.spanIdParam}
              onPrevious={handlePreviousTrace}
              onNext={handleNextTrace}
              collapsed={traceCollapsed}
              onCollapsedChange={setTraceCollapsed}
              placement="traces-list"
              LinkComponent={Link}
              traceHref={`/traces/${url.traceIdParam}`}
            />
          ) : null
        }
        spanPanelSlot={
          url.traceIdParam && url.spanIdParam ? (
            <SpanDataPanelView
              traceId={url.traceIdParam}
              spanId={url.spanIdParam}
              span={spanDetailData?.span}
              isLoading={isLoadingSpanDetail}
              onClose={url.handleSpanClose}
              onPrevious={handlePreviousSpan}
              onNext={handleNextSpan}
              activeTab={url.spanTabParam ?? 'details'}
              onTabChange={tab => url.handleSpanTabChange(tab as SpanTab)}
              feedbackTabBadge={feedbackData?.pagination?.total ?? undefined}
              feedbackTabSlot={() => (
                <SpanFeedbackList
                  feedbackData={feedbackData}
                  onPageChange={setFeedbackPage}
                  isLoadingFeedbackData={isLoadingFeedback}
                />
              )}
              scoringTabBadge={spanScoresData?.pagination?.total ?? undefined}
              scoringTabSlot={({ span, traceId: tid, spanId: sid }) => (
                <div className="grid gap-6">
                  <SpanScoring
                    traceId={tid}
                    isTopLevelSpan={!Boolean(span.parentSpanId)}
                    spanId={sid}
                    entityType={
                      span.attributes?.agentId || span.entityType === EntityType.AGENT
                        ? 'Agent'
                        : span.attributes?.workflowId || span.entityType === EntityType.WORKFLOW_RUN
                          ? 'Workflow'
                          : undefined
                    }
                    scorers={scorers}
                    isLoadingScorers={isLoadingScorers}
                  />
                  <SpanScoresList
                    scoresData={spanScoresData}
                    onPageChange={setSpanScoresPage}
                    isLoadingScoresData={isLoadingSpanScoresData}
                    onScoreSelect={score => url.handleScoreChange(score.id)}
                  />
                </div>
              )}
            />
          ) : null
        }
        scorePanelSlot={
          featuredScore ? <ScoreDataPanel score={featuredScore} onClose={() => url.handleScoreChange(null)} /> : null
        }
      />

      {datasetDialogTarget && (
        <TraceAsItemDialog
          rootSpanId={datasetDialogTarget.rootSpanId}
          traceId={datasetDialogTarget.traceId}
          isOpen
          onClose={() => setDatasetDialogTarget(null)}
        />
      )}
    </PageLayout>
  );
}
