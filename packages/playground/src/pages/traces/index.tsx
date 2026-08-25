import type { EntityType } from '@mastra/core/observability';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { Label } from '@mastra/playground-ui/components/Label';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import { NoTracesInfo } from '@mastra/playground-ui/domains/traces/components/no-traces-info';
import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import { TraceColumnsMenu } from '@mastra/playground-ui/domains/traces/components/trace-columns-menu';
import { TraceDataPanelView } from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import type { TraceDataPanelTab } from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { TracesLayout } from '@mastra/playground-ui/domains/traces/components/traces-layout';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { TracesToolbar } from '@mastra/playground-ui/domains/traces/components/traces-toolbar';
import { useEntityNames } from '@mastra/playground-ui/domains/traces/hooks/use-entity-names';
import { useEnvironments } from '@mastra/playground-ui/domains/traces/hooks/use-environments';
import { useServiceNames } from '@mastra/playground-ui/domains/traces/hooks/use-service-names';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTags } from '@mastra/playground-ui/domains/traces/hooks/use-tags';
import { useTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/hooks/use-trace-column-preferences';
import { useTraceFilterPersistence } from '@mastra/playground-ui/domains/traces/hooks/use-trace-filter-persistence';
import { useTraceListNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-list-navigation';
import { useTraceOrBranchSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-or-branch-spans';
import { useTraceSpanNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-span-navigation';
import { useTraceUrlState } from '@mastra/playground-ui/domains/traces/hooks/use-trace-url-state';
import { useTraceUsage } from '@mastra/playground-ui/domains/traces/hooks/use-trace-usage';
import { useTraces } from '@mastra/playground-ui/domains/traces/hooks/use-traces';
import {
  buildTraceListFilters,
  createTracePropertyFilterFields,
  neutralizeFilterTokens,
} from '@mastra/playground-ui/domains/traces/trace-filters';
import { hasTraceUsageColumn, isTraceUsageColumn } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import type { SpanTab } from '@mastra/playground-ui/domains/traces/types';
import { isBranchesNotSupportedError } from '@mastra/playground-ui/utils/errors';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';
import { AddTraceMocksToItemDialog } from '@/domains/observability/components/add-trace-mocks-to-item-dialog';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { TraceScoreLineChart } from '@/domains/observability/components/trace-score-line-chart';
import { useScorers } from '@/domains/scores';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';
import { SpanFeedbackList } from '@/domains/traces/components/span-feedback-list';
import { SpanScoresList } from '@/domains/traces/components/span-scores-list';
import { SpanScoring } from '@/domains/traces/components/span-scoring';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
import { Link } from '@/lib/link';

type TracesPageProps = {
  scopedEntityId?: string;
  scopedEntityType?: EntityType;
};

export default function TracesPage({ scopedEntityId, scopedEntityType }: TracesPageProps = {}) {
  const isScoped = !!scopedEntityId;
  const [searchParams, setSearchParams] = useSearchParams();
  const url = useTraceUrlState(searchParams, setSearchParams);

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
  const [spanScoresPage, setSpanScoresPage] = useState(0);
  const [traceTab, setTraceTab] = useState<TraceDataPanelTab>('details');
  // Tab is per-trace; a stale "scores" tab from the previous trace shouldn't leak into the next one.
  useEffect(() => setTraceTab('details'), [url.traceIdParam, url.anchorSpanIdParam]);
  // Set once we detect the active storage provider doesn't implement `listBranches`. Drives both the
  // auto-flip from branches→traces below and hiding the Branches option in the List mode filter.
  const [branchesUnsupported, setBranchesUnsupported] = useState(false);
  const [branchesNoticeDismissed, setBranchesNoticeDismissed] = useState(false);
  const [datasetDialogTarget, setDatasetDialogTarget] = useState<{
    traceId: string;
    rootSpanId: string | undefined;
  } | null>(null);
  const [addMocksTarget, setAddMocksTarget] = useState<{ traceId: string } | null>(null);

  // Reset pagination whenever the selected trace changes — otherwise a page index from a
  // previous trace could be reused against a trace that has fewer (or no) scores.
  useEffect(() => setSpanScoresPage(0), [url.traceIdParam, url.anchorSpanIdParam]);

  const { data: scorers, isLoading: isLoadingScorers } = useScorers();

  const [feedbackPage, setFeedbackPage] = useState(0);
  useEffect(() => setFeedbackPage(0), [url.traceIdParam, url.spanIdParam]);
  const { data: feedbackData, isLoading: isLoadingFeedback } = useTraceFeedback({
    traceId: url.traceIdParam,
    page: feedbackPage,
  });

  // Trace + span detail fetched at the page level (was inside the old smart components).
  // In branches mode the data source is `getBranch` (subtree rooted at the selected span);
  // in traces mode it's `getTraceLight` (full tree from the root).
  const {
    spans: lightSpans,
    anchorSpanId,
    isLoading: isLoadingLightSpans,
  } = useTraceOrBranchSpans({
    traceId: url.traceIdParam ?? null,
    // In branches mode the anchor lives in its own URL param so intra-panel span navigation
    // (which changes `spanIdParam`) doesn't re-fetch the subtree from a different root.
    anchorSpanId: url.listMode === 'branches' ? (url.anchorSpanIdParam ?? null) : null,
    listMode: url.listMode,
  });
  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail(
    url.traceIdParam ?? '',
    url.spanIdParam ?? '',
  );

  // Displayed root of the current view: branch anchor in branches mode, trace root otherwise.
  const anchorSpan = useMemo(
    () =>
      anchorSpanId ? lightSpans?.find(s => s.spanId === anchorSpanId) : lightSpans?.find(s => s.parentSpanId == null),
    [lightSpans, anchorSpanId],
  );

  // Trace-level scores shown in the trace panel's "Scores" tab, anchored at the displayed root span.
  const { data: spanScoresData, isLoading: isLoadingSpanScoresData } = useTraceSpanScores({
    traceId: url.traceIdParam,
    spanId: anchorSpan?.spanId,
    page: spanScoresPage,
  });

  // Derived from URL + query data — no local state, so a span change (which clears scoreIdParam
  // in the URL) or a direct URL edit always resyncs ScoreDataPanel.
  const featuredScore = url.scoreIdParam ? spanScoresData?.scores?.find(s => s.id === url.scoreIdParam) : undefined;

  const { data: availableTags = [], isPending: isTagsLoading } = useTags();
  const { data: rootEntityNameSuggestions = [], isPending: isEntityNamesLoading } = useEntityNames({
    entityType: url.selectedEntityOption?.entityType as EntityType | undefined,
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
        rootEntityType: url.selectedEntityOption?.entityType as EntityType | undefined,
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
    autoRefetch: autoRefetchTraces,
    setAutoRefetch: setAutoRefetchTraces,
    recentlyAddedKeys: recentlyAddedTraceKeys,
  } = useTraces({ filters: traceFilters, listMode: url.listMode });

  const traces = useMemo(() => tracesData?.spans ?? [], [tracesData?.spans]);
  const traceColumns = useTraceColumnPreferences();
  const observabilityCapabilities = useObservabilityStorageCapabilities();
  const usageDisabledReason =
    url.listMode === 'branches'
      ? 'Token and cost totals are only available for full traces.'
      : observabilityCapabilities.isLoading
        ? 'Checking whether this storage supports usage data.'
        : !observabilityCapabilities.supportsMetrics
          ? 'This observability store does not support token and cost metrics.'
          : undefined;
  const usageColumnsUnavailable =
    url.listMode === 'branches' || (!observabilityCapabilities.isLoading && !observabilityCapabilities.supportsMetrics);
  const displayedColumnPreferences = usageColumnsUnavailable
    ? {
        ...traceColumns.preferences,
        visibleColumns: traceColumns.preferences.visibleColumns.filter(column => !isTraceUsageColumn(column)),
      }
    : traceColumns.preferences;
  const selectedBranchAnchor =
    url.listMode === 'branches' && anchorSpanId ? lightSpans?.find(span => span.spanId === anchorSpanId) : undefined;
  const canShowSelectedTraceUsage =
    url.listMode === 'traces' || (selectedBranchAnchor !== undefined && selectedBranchAnchor.parentSpanId == null);
  const listUsageEnabled =
    !usageColumnsUnavailable && !observabilityCapabilities.isLoading && hasTraceUsageColumn(displayedColumnPreferences);
  const traceUsage = useTraceUsage({
    traceIds: traces.map(trace => trace.traceId),
    enabled: listUsageEnabled,
    autoRefetch: autoRefetchTraces,
  });
  const selectedTraceId = url.traceIdParam;
  const selectedTraceCoveredByListUsage =
    canShowSelectedTraceUsage &&
    selectedTraceId !== undefined &&
    listUsageEnabled &&
    traces.some(trace => trace.traceId === selectedTraceId);
  const selectedTraceUsageFromList = selectedTraceId ? traceUsage.data?.get(selectedTraceId) : undefined;
  const selectedTraceNeedsOwnQuery =
    canShowSelectedTraceUsage &&
    selectedTraceId !== undefined &&
    (!selectedTraceCoveredByListUsage ||
      (!traceUsage.isFetching && traceUsage.data !== undefined && !traceUsage.data.has(selectedTraceId)));
  // Fetch independently when the list query cannot supply the selected trace,
  // such as when usage columns are hidden or a direct link is outside the loaded page.
  const selectedTraceUsage = useTraceUsage({
    traceIds: selectedTraceNeedsOwnQuery && selectedTraceId ? [selectedTraceId] : [],
    enabled:
      selectedTraceNeedsOwnQuery && !observabilityCapabilities.isLoading && observabilityCapabilities.supportsMetrics,
    autoRefetch: autoRefetchTraces,
  });

  // Storage providers that don't implement `listBranches` throw a known MastraError. When that
  // surfaces in branches mode, treat the provider as branches-incapable for the rest of the
  // session: flip the URL back to traces mode so the next query succeeds, and remove the
  // Branches option from the List mode filter (see `branchesSupported` in `filterFields`).
  useEffect(() => {
    if (!tracesError || branchesUnsupported) return;
    if (!isBranchesNotSupportedError(tracesError)) return;
    setBranchesUnsupported(true);
    if (url.listMode === 'branches') url.handleListModeChange('traces');
  }, [tracesError, branchesUnsupported, url]);

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

  // Branch prev/next steps through (traceId, anchorSpanId) pairs — passing the same span as
  // both `spanId` and `anchorSpanId` so the new branch opens with its anchor selected, just
  // like clicking a row.
  const handleBranchOrTraceNavigate = useCallback(
    (traceId: string, spanId?: string) => {
      if (url.listMode === 'branches') {
        url.handleTraceClick(traceId, spanId, spanId);
      } else {
        url.handleTraceClick(traceId);
      }
    },
    [url],
  );
  const { handlePreviousTrace, handleNextTrace } = useTraceListNavigation(
    traces,
    url.traceIdParam,
    url.listMode === 'branches' ? url.anchorSpanIdParam : null,
    handleBranchOrTraceNavigate,
  );

  // "Evaluate Trace" switches the trace panel to its "Scores" tab (expanding the panel if needed).
  const handleEvaluateTrace = useCallback(() => {
    setTraceTab('scores');
  }, []);

  // Tool mocks only make sense for agent runs — gate the "Add tool mocks to item" action
  // on the displayed root/anchor span being an agent.
  const isAgentTrace = anchorSpan?.entityType === 'agent';

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
      <div className="min-h-form-default ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
        <TraceColumnsMenu
          preferences={traceColumns.preferences}
          usageDisabledReason={usageDisabledReason}
          onToggleColumn={traceColumns.toggleColumn}
          onAddMetadataColumn={traceColumns.addMetadataColumn}
          onRemoveMetadataColumn={traceColumns.removeMetadataColumn}
          onReset={traceColumns.resetColumns}
        />
        {!branchesUnsupported && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-subtraces"
              checked={url.listMode === 'branches'}
              onCheckedChange={checked => url.handleListModeChange(checked === true ? 'branches' : 'traces')}
              disabled={isTracesLoading}
            />
            <Label htmlFor="show-subtraces">Subtraces</Label>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-refetch"
            checked={autoRefetchTraces}
            onCheckedChange={checked => setAutoRefetchTraces(checked === true)}
            disabled={isTracesLoading}
          />
          <Label htmlFor="auto-refetch">Auto refresh</Label>
        </div>
      </div>
    </>
  );

  const branchesUnsupportedNotice =
    branchesUnsupported && !branchesNoticeDismissed ? (
      <Notice
        variant="info"
        action={
          <Notice.Button variant="ghost" onClick={() => setBranchesNoticeDismissed(true)}>
            Dismiss
          </Notice.Button>
        }
        className="mb-4"
      >
        <Notice.Message>
          Selected list mode isn't supported by this storage provider — switched to default.
        </Notice.Message>
      </Notice>
    ) : null;

  const pageTopArea = (
    <PageLayout.TopArea>
      <PageLayout.Row>
        <PageLayout.Column className="flex w-full flex-wrap items-start justify-start gap-2">
          {toolbarControls}
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
        lockedFieldIds={lockedFieldIds}
        lockedTooltipContent={lockedTooltipContent}
      />

      {branchesUnsupportedNotice}
    </PageLayout.TopArea>
  );

  // Swallow the "branches not supported" error — the effect above flips listMode back to traces
  // and the next query will succeed. Showing the red error screen for one frame would be jarring.
  if (tracesError && !isBranchesNotSupportedError(tracesError)) {
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

  if (traces.length === 0 && !isTracesLoading && !contentFiltersApplied && !url.traceIdParam) {
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
        sidePanelWide={!!url.spanIdParam}
        listSlot={
          <TracesListView
            // Remount on mode switch: the virtualizer caches measurements / scroll state from
            // the previous mode's row count, and `isLoading` doesn't flash when switching with
            // cached data (so the existing scroll-reset effect in TracesListView wouldn't fire).
            // A fresh mount gives the virtualizer a clean count from the current `traces` array.
            key={url.listMode}
            traces={traces}
            isLoading={isTracesLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            setEndOfListElement={setEndOfListElement}
            filtersApplied={filtersApplied}
            featuredTraceId={url.traceIdParam}
            // In branches mode the row identity is (traceId, anchorSpanId) — spanIdParam may
            // have drifted via intra-panel span nav and shouldn't decide which row is featured.
            featuredSpanId={url.listMode === 'branches' ? url.anchorSpanIdParam : null}
            isBranchesMode={url.listMode === 'branches'}
            recentlyAddedKeys={recentlyAddedTraceKeys}
            columnPreferences={displayedColumnPreferences}
            usageByTraceId={traceUsage.data}
            onTraceClick={trace => {
              const isBranches = url.listMode === 'branches';
              const isSameRow = isBranches
                ? url.traceIdParam === trace.traceId && url.anchorSpanIdParam === trace.spanId
                : url.traceIdParam === trace.traceId;
              if (isSameRow) {
                url.handleTraceClick('');
                return;
              }
              // Branches mode: seed both anchorSpanId (the branch identity) and spanId (initial
              // selected span = the anchor). Span nav inside the panel only mutates spanId after.
              const branchSpanId = isBranches ? (trace.spanId ?? undefined) : undefined;
              url.handleTraceClick(trace.traceId, branchSpanId, branchSpanId);
            }}
          />
        }
        tracePanelSlot={
          url.traceIdParam && (url.listMode !== 'branches' || url.anchorSpanIdParam) ? (
            <TraceDataPanelView
              traceId={url.traceIdParam}
              spans={lightSpans}
              usage={
                canShowSelectedTraceUsage
                  ? (selectedTraceUsageFromList ?? selectedTraceUsage.data?.get(url.traceIdParam))
                  : undefined
              }
              anchorSpanId={anchorSpanId}
              isLoading={isLoadingLightSpans}
              onClose={url.handleTraceClose}
              onSpanSelect={id => url.handleSpanChange(id ?? null)}
              onEvaluateTrace={handleEvaluateTrace}
              onSaveAsDatasetItem={args => setDatasetDialogTarget(args)}
              onAddTraceMocksToItem={isAgentTrace ? args => setAddMocksTarget(args) : undefined}
              initialSpanId={url.spanIdParam}
              onPrevious={handlePreviousTrace}
              onNext={handleNextTrace}
              placement="traces-list"
              LinkComponent={Link}
              activeTab={traceTab}
              onTabChange={setTraceTab}
              scoresTabBadge={spanScoresData?.pagination?.total ?? undefined}
              scoresTabSlot={({ traceId: tid, rootSpanId }) =>
                rootSpanId ? (
                  <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-6">
                    <SpanScoring
                      traceId={tid}
                      isTopLevelSpan={!anchorSpan?.parentSpanId}
                      spanId={rootSpanId}
                      entityType={
                        anchorSpan?.entityType === 'agent'
                          ? 'Agent'
                          : anchorSpan?.entityType === 'workflow_run'
                            ? 'Workflow'
                            : undefined
                      }
                      scorers={scorers}
                      isLoadingScorers={isLoadingScorers}
                    />
                    <TraceScoreLineChart scoresData={spanScoresData} className="min-h-0 w-full" />
                    <Card appearance="surface" className="min-h-0 w-full overflow-hidden">
                      <CardContent className="h-full overflow-y-auto">
                        <SpanScoresList
                          scoresData={spanScoresData}
                          onPageChange={setSpanScoresPage}
                          isLoadingScoresData={isLoadingSpanScoresData}
                          onScoreSelect={score => url.handleScoreChange(score.id)}
                        />
                      </CardContent>
                    </Card>
                  </div>
                ) : null
              }
              spanPanelSlot={
                url.spanIdParam ? (
                  <SpanDataPanelView
                    traceId={url.traceIdParam}
                    spanId={url.spanIdParam}
                    span={spanDetailData?.span}
                    isAnchor={anchorSpanId ? url.spanIdParam === anchorSpanId : undefined}
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
                    className="rounded-none border-0 bg-transparent"
                  />
                ) : null
              }
            />
          ) : null
        }
        scorePanelSlot={
          featuredScore ? <ScoreDataPanel score={featuredScore} onClose={() => url.handleScoreChange(null)} /> : null
        }
      />

      <TraceAsItemDialog
        rootSpanId={datasetDialogTarget?.rootSpanId}
        traceId={datasetDialogTarget?.traceId}
        isOpen={!!datasetDialogTarget}
        onClose={() => setDatasetDialogTarget(null)}
      />

      <AddTraceMocksToItemDialog
        traceId={addMocksTarget?.traceId}
        isOpen={!!addMocksTarget}
        onClose={() => setAddMocksTarget(null)}
      />
    </PageLayout>
  );
}
