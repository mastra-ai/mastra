import { EntityType } from '@mastra/core/observability';
import {
  ButtonWithTooltip,
  ColumnsConfigurator,
  DateTimeRangePicker,
  NoTracesInfo,
  PageHeader,
  PageLayout,
  PropertyFilterCreator,
  SpanDataPanelView,
  TraceDataPanelView,
  TracesDataList,
  TracesErrorContent,
  TracesLayout,
  TracesListView,
  TracesToolbar,
  buildTraceListFilters,
  createTracePropertyFilterFields,
  neutralizeFilterTokens,
  buildVisibleColumnDefs,
  useColumnPreferences,
  useCustomColumns,
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
import type { CustomColumnSource, SpanTab } from '@mastra/playground-ui';
import { BookIcon, EyeIcon, ListIcon, ListTreeIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { useRootSpanJsonKeys } from '@/domains/observability/hooks/use-root-span-json-keys';
import { useScorers } from '@/domains/scores';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';
import { SpanFeedbackList } from '@/domains/traces/components/span-feedback-list';
import { SpanScoresList } from '@/domains/traces/components/span-scores-list';
import { SpanScoring } from '@/domains/traces/components/span-scoring';
import {
  ALL_BUILT_IN_COLUMN_DEFS,
  OPTIONAL_TRACES_COLUMN_CONFIGS,
  TRACES_COLUMN_CONFIGS,
  TRACES_COLUMN_NAMES,
  TRACE_COLUMN_DEFS,
  TRACE_CUSTOM_COLUMN_SOURCES,
  formatCellValue,
  resolveCustomColumnValue,
} from '@/domains/traces/components/trace-columns';
import type { Trace, TraceCustomColumnSource } from '@/domains/traces/components/trace-columns';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
import { Link } from '@/lib/link';

const TRACES_COLUMNS_STORAGE_KEY = 'traces:columns:visible';
const TRACES_CUSTOM_COLUMNS_STORAGE_KEY = 'traces:columns:custom';
const TRACES_REQUIRED_COLUMNS = ['shortId'];

/**
 * Per-column grid sizes used by the virtualized list. Built-in columns use
 * fixed widths to avoid horizontal jitter as rows enter/leave the virtualizer
 * window; only the input cell flexes. Custom columns fall back to
 * `TRACES_COLUMN_WIDTHS.other` below.
 */
const TRACES_COLUMN_WIDTHS: Record<string, string> = {
  shortId: '7rem',
  date: '6rem',
  time: '9rem',
  name: 'minmax(8rem,1fr)',
  input: 'minmax(12rem,2fr)',
  entityId: '14rem',
  status: '6rem',
  other: '10rem',
};

const CUSTOM_SOURCE_LABELS: Record<TraceCustomColumnSource, string> = {
  metadata: 'Metadata',
  attributes: 'Attributes',
};

type TracesPageProps = {
  scopedEntityId?: string;
  scopedEntityType?: EntityType;
};

export default function TracesPage({ scopedEntityId, scopedEntityType }: TracesPageProps = {}) {
  const isScoped = !!scopedEntityId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupByThread, setGroupByThread] = useState<boolean>(false);
  const url = useTraceUrlState(searchParams, setSearchParams, {
    onRemoveAll: () => setGroupByThread(false),
  });

  useEffect(() => {
    if (!scopedEntityId) return;
    const currentRoot = searchParams.get('rootEntityType');
    const currentEntityId = searchParams.get('filterEntityId');
    const needsRoot = !!scopedEntityType && currentRoot !== scopedEntityType;
    const needsEntityId = currentEntityId !== scopedEntityId;
    if (!needsRoot && !needsEntityId) return;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (scopedEntityType) next.set('rootEntityType', scopedEntityType);
        next.set('filterEntityId', scopedEntityId);
        return next;
      },
      { replace: true },
    );
  }, [scopedEntityId, scopedEntityType, searchParams, setSearchParams]);

  const lockedFieldIds = useMemo<readonly string[]>(() => (isScoped ? ['rootEntityType', 'entityId'] : []), [isScoped]);
  const hiddenCreatorFieldIds = useMemo<readonly string[]>(
    () => (isScoped ? ['rootEntityType', 'entityId', 'entityName'] : []),
    [isScoped],
  );
  const lockedTooltipContent = isScoped
    ? 'This filter is scoped to the current agent. Open the global Traces view to change it.'
    : undefined;

  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();
  const [visibleColumnNames, setVisibleColumnNames] = useColumnPreferences(
    TRACES_COLUMNS_STORAGE_KEY,
    TRACES_COLUMN_NAMES,
  );
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
  } = useTraces({ filters: traceFilters, listMode: url.listMode });

  const traces = useMemo(() => tracesData?.spans ?? [], [tracesData?.spans]);
  const threadTitles = tracesData?.threadTitles ?? {};

  // Autocomplete hints come from the backend's project-wide distinct-keys discovery
  // (see /observability/discovery/root-span-keys). Narrowing trace filters does not
  // shrink these lists.
  const { data: discoveredMetadataKeys = [] } = useRootSpanJsonKeys('metadata');
  const { data: discoveredAttributeKeys = [] } = useRootSpanJsonKeys('attributes');

  const { customColumns, addCustomColumn, removeCustomColumn } = useCustomColumns(TRACES_CUSTOM_COLUMNS_STORAGE_KEY);

  const customColumnSources: CustomColumnSource[] = useMemo(
    () =>
      TRACE_CUSTOM_COLUMN_SOURCES.map(id => ({
        id,
        label: CUSTOM_SOURCE_LABELS[id],
        discoveredKeys: id === 'metadata' ? discoveredMetadataKeys : discoveredAttributeKeys,
      })),
    [discoveredMetadataKeys, discoveredAttributeKeys],
  );

  const visibleColumnDefs = useMemo(
    () =>
      buildVisibleColumnDefs<Trace>({
        visibleNames: visibleColumnNames,
        defaultDefs: TRACE_COLUMN_DEFS,
        allBuiltInDefs: ALL_BUILT_IN_COLUMN_DEFS,
        customColumns,
        widths: TRACES_COLUMN_WIDTHS,
        customSources: TRACE_CUSTOM_COLUMN_SOURCES,
        renderCustomCell: (trace, source, key) => (
          <TracesDataList.NameCell name={formatCellValue(resolveCustomColumnValue(trace, source, key))} />
        ),
      }),
    [visibleColumnNames, customColumns],
  );

  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(lightSpans, url.spanIdParam ?? null, id =>
    url.handleSpanChange(id),
  );

  const persistence = useTraceFilterPersistence(searchParams, setSearchParams, {
    storageKey: isScoped ? `mastra:traces:saved-filters:${scopedEntityType}:${scopedEntityId}` : undefined,
  });

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

  const filtersApplied =
    !!url.selectedEntityOption ||
    !!url.selectedStatus ||
    url.filterTokens.length > 0 ||
    url.datePreset !== 'last-24h' ||
    !!url.selectedDateTo;

  const toolbarControls = (
    <>
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
        hiddenFieldIds={hiddenCreatorFieldIds}
      />
      <ColumnsConfigurator
        columns={TRACES_COLUMN_CONFIGS}
        optionalColumns={OPTIONAL_TRACES_COLUMN_CONFIGS}
        visibleColumns={visibleColumnNames}
        onVisibleColumnsChange={setVisibleColumnNames}
        requiredColumns={TRACES_REQUIRED_COLUMNS}
        customColumns={customColumns}
        customColumnSources={customColumnSources}
        onAddCustomColumn={addCustomColumn}
        onRemoveCustomColumn={removeCustomColumn}
        disabled={isTracesLoading}
        defaultVisibleColumns={TRACES_COLUMN_NAMES}
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
    </>
  );

  const pageTopArea = (
    <PageLayout.TopArea>
      <PageLayout.Row>
        {isScoped ? (
          <PageLayout.Column className="flex items-start justify-start gap-2 flex-wrap">
            {toolbarControls}
          </PageLayout.Column>
        ) : (
          <>
            <PageLayout.Column>
              <PageHeader>
                <PageHeader.Title isLoading={isTracesLoading}>
                  <EyeIcon /> Traces
                </PageHeader.Title>
              </PageHeader>
            </PageLayout.Column>
            <PageLayout.Column className="flex justify-end items-center gap-2">{toolbarControls}</PageLayout.Column>
          </>
        )}
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
        lockedFieldIds={lockedFieldIds}
        lockedTooltipContent={lockedTooltipContent}
      />
    </PageLayout.TopArea>
  );

  if (tracesError) {
    return (
      <PageLayout width="wide" height="full">
        {pageTopArea}
        <PageLayout.MainArea isCentered>
          <TracesErrorContent error={tracesError} resource="traces" errorTitle="Failed to load traces" />
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  const contentFiltersApplied = !!url.selectedEntityOption || !!url.selectedStatus || url.filterTokens.length > 0;

  if (traces.length === 0 && !isTracesLoading && !contentFiltersApplied) {
    return (
      <PageLayout width="wide" height="full">
        {pageTopArea}
        <PageLayout.MainArea isCentered>
          <NoTracesInfo datePreset={url.datePreset} dateFrom={url.selectedDateFrom} dateTo={url.selectedDateTo} />
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      {pageTopArea}

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
            columnDefs={visibleColumnDefs}
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
