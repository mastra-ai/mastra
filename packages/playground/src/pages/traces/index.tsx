import type { EntityType } from '@mastra/core/observability';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { Label } from '@mastra/playground-ui/components/Label';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import { NoTracesInfo } from '@mastra/playground-ui/domains/traces/components/no-traces-info';
import { TraceColumnsMenu } from '@mastra/playground-ui/domains/traces/components/trace-columns-menu';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { TracesLayout } from '@mastra/playground-ui/domains/traces/components/traces-layout';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { TracesToolbar } from '@mastra/playground-ui/domains/traces/components/traces-toolbar';
import { useEntityNames } from '@mastra/playground-ui/domains/traces/hooks/use-entity-names';
import { useEnvironments } from '@mastra/playground-ui/domains/traces/hooks/use-environments';
import { useServiceNames } from '@mastra/playground-ui/domains/traces/hooks/use-service-names';
import { useTags } from '@mastra/playground-ui/domains/traces/hooks/use-tags';
import { useTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/hooks/use-trace-column-preferences';
import { useTraceFilterPersistence } from '@mastra/playground-ui/domains/traces/hooks/use-trace-filter-persistence';
import { useTraceListNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-list-navigation';
import { useTraceOrBranchSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-or-branch-spans';
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
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';
import { SpanFeedbackTab } from '@/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceScoresTab } from '@/domains/traces/components/trace-scores-tab';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';
import { useSpanFeedback } from '@/domains/traces/hooks/use-span-feedback';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';

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
  // Set once we detect the active storage provider doesn't implement `listBranches`. Drives both the
  // auto-flip from branches→traces below and hiding the Branches option in the List mode filter.
  const [branchesUnsupported, setBranchesUnsupported] = useState(false);
  const [branchesNoticeDismissed, setBranchesNoticeDismissed] = useState(false);
  const [datasetDialogTarget, setDatasetDialogTarget] = useState<{
    traceId: string;
    rootSpanId: string | undefined;
  } | null>(null);
  const [addMocksTarget, setAddMocksTarget] = useState<{ traceId: string } | null>(null);

  // Counts for the tab badges. The tab bodies own their pagination and re-use these
  // first-page queries through React Query's cache.
  const { data: traceFeedbackData } = useTraceFeedback({ traceId: url.traceIdParam });
  const { data: spanFeedbackData } = useSpanFeedback({ traceId: url.traceIdParam, spanId: url.spanIdParam });

  // Trace + span detail fetched at the page level (was inside the old smart components).
  // In branches mode the data source is `getBranch` (subtree rooted at the selected span);
  // in traces mode it's `getTrace` (full tree from the root). Both carry full span payloads,
  // which is what the panel renders and what its search reads.
  const {
    spans: traceSpans,
    anchorSpanId,
    isLoading: isLoadingTraceSpans,
  } = useTraceOrBranchSpans({
    traceId: url.traceIdParam ?? null,
    // In branches mode the anchor lives in its own URL param so intra-panel span navigation
    // (which changes `spanIdParam`) doesn't re-fetch the subtree from a different root.
    anchorSpanId: url.listMode === 'branches' ? (url.anchorSpanIdParam ?? null) : null,
    listMode: url.listMode,
  });
  // Displayed root of the current view: branch anchor in branches mode, trace root otherwise.
  const anchorSpan = useMemo(
    () =>
      anchorSpanId ? traceSpans?.find(s => s.spanId === anchorSpanId) : traceSpans?.find(s => s.parentSpanId == null),
    [traceSpans, anchorSpanId],
  );

  // First page of the anchor span's scores: feeds the tab badge and the featured score lookup.
  // The scores tab body owns its own pagination and re-uses this query through React Query's cache.
  const { data: spanScoresData } = useTraceSpanScores({
    traceId: url.traceIdParam,
    spanId: anchorSpan?.spanId,
  });

  const anchorSpanEntityType =
    anchorSpan?.entityType === 'agent' ? 'Agent' : anchorSpan?.entityType === 'workflow_run' ? 'Workflow' : undefined;

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
  const listUsageEnabled =
    !usageColumnsUnavailable && !observabilityCapabilities.isLoading && hasTraceUsageColumn(displayedColumnPreferences);
  const traceUsage = useTraceUsage({
    traceIds: traces.map(trace => trace.traceId),
    enabled: listUsageEnabled,
    autoRefetch: autoRefetchTraces,
  });
  const selectedTraceUsesListQuery = listUsageEnabled && traces.some(trace => trace.traceId === url.traceIdParam);
  const selectedTraceUsage = useTraceUsage({
    traceIds: url.traceIdParam ? [url.traceIdParam] : [],
    enabled: listUsageEnabled && !selectedTraceUsesListQuery,
    autoRefetch: autoRefetchTraces,
  });
  const selectedTraceUsageSummary = url.traceIdParam
    ? (traceUsage.data?.get(url.traceIdParam) ?? selectedTraceUsage.data?.get(url.traceIdParam))
    : undefined;
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
            <TraceSpanPanel
              key={`${url.traceIdParam}:${url.anchorSpanIdParam ?? ''}`}
              traceId={url.traceIdParam}
              spans={traceSpans}
              anchorSpanId={anchorSpanId}
              usage={selectedTraceUsageSummary}
              isLoadingSpans={isLoadingTraceSpans}
              selectedSpanId={url.spanIdParam ?? null}
              onClose={url.handleTraceClose}
              onSpanSelect={id => url.handleSpanChange(id ?? null)}
              onSpanClose={url.handleSpanClose}
              onSaveAsDatasetItem={args => setDatasetDialogTarget(args)}
              onAddTraceMocksToItem={isAgentTrace ? args => setAddMocksTarget(args) : undefined}
              initialSpanId={url.spanIdParam}
              onPrevious={handlePreviousTrace}
              onNext={handleNextTrace}
              feedbackTabBadge={traceFeedbackData?.pagination?.total ?? undefined}
              feedbackTabSlot={({ traceId: tid }) => <TraceFeedbackTab traceId={tid} />}
              scoresTabBadge={spanScoresData?.pagination?.total ?? undefined}
              scoresTabSlot={({ traceId: tid, rootSpanId }) =>
                rootSpanId ? (
                  <TraceScoresTab
                    traceId={tid}
                    spanId={rootSpanId}
                    isTopLevelSpan={!anchorSpan?.parentSpanId}
                    entityType={anchorSpanEntityType}
                    onScoreSelect={url.handleScoreChange}
                  />
                ) : null
              }
              spanActiveTab={url.spanTabParam ?? 'details'}
              onSpanTabChange={tab => url.handleSpanTabChange(tab as SpanTab)}
              spanFeedbackTabBadge={spanFeedbackData?.pagination?.total ?? undefined}
              spanFeedbackTabSlot={({ traceId: tid, spanId: sid }) =>
                tid && sid ? <SpanFeedbackTab key={`${tid}:${sid}`} traceId={tid} spanId={sid} /> : null
              }
              spanPanelClassName="rounded-none border-0 bg-transparent"
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
