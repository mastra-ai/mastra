import type { EntityType } from '@mastra/core/observability';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarItem } from '@mastra/playground-ui/components/FilterBar';
import { Label } from '@mastra/playground-ui/components/Label';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { NoTracesInfo } from '@mastra/playground-ui/domains/traces/components/no-traces-info';
import { TraceColumnsMenu } from '@mastra/playground-ui/domains/traces/components/trace-columns-menu';
import {
  TRACE_TIME_RANGE_FIELD,
  TRACE_TIME_RANGE_FIELD_ID,
  TRACE_TIME_RANGE_ITEM,
  TraceTimeRangeChip,
} from '@mastra/playground-ui/domains/traces/components/trace-time-range-chip';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { TracesLayout } from '@mastra/playground-ui/domains/traces/components/traces-layout';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { useEntityNames } from '@mastra/playground-ui/domains/traces/hooks/use-entity-names';
import { useEnvironments } from '@mastra/playground-ui/domains/traces/hooks/use-environments';
import { useTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/hooks/use-trace-column-preferences';
import { useTraceFilterPersistence } from '@mastra/playground-ui/domains/traces/hooks/use-trace-filter-persistence';
import { useTraceListNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-list-navigation';
import { useTraceOrBranchSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-or-branch-spans';
import { useTraceUrlState } from '@mastra/playground-ui/domains/traces/hooks/use-trace-url-state';
import { useTraceUsage } from '@mastra/playground-ui/domains/traces/hooks/use-trace-usage';
import {
  createTraceFilterBarFields,
  filterBarItemsToTraceTokens,
  TRACE_FILTER_BAR_OPERATORS,
  traceTokensToFilterBarItems,
} from '@mastra/playground-ui/domains/traces/trace-filters';
import { hasTraceUsageColumn, isTraceUsageColumn } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import {
  buildTraceQueryRequest,
  TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS,
} from '@mastra/playground-ui/domains/traces/trace-query-filters';
import type { SpanTab } from '@mastra/playground-ui/domains/traces/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTracesListSource } from './hooks/use-traces-list-source';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';
import { AddTraceMocksToItemDialog } from '@/domains/observability/components/add-trace-mocks-to-item-dialog';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { NeedsReviewDot } from '@/domains/traces/components/needs-review-dot';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';
import { SpanFeedbackTab } from '@/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceScoresTab } from '@/domains/traces/components/trace-scores-tab';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';
import { getTraceThreadId } from '@/domains/traces/components/trace-thread-context';
import { useSpanFeedback } from '@/domains/traces/hooks/use-span-feedback';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';

type TracesPageProps = {
  scopedEntityId?: string;
  scopedEntityType?: EntityType;
};

export default function TracesPage({ scopedEntityId, scopedEntityType }: TracesPageProps = {}) {
  const isScoped = !!scopedEntityId;
  const [searchParams, setSearchParams] = useSearchParams();

  // Must run before `useTraceFilterPersistence` hydrates: react-router resolves functional
  // `setSearchParams` updates against the render-time params, so within one commit the last
  // call wins. Scoping first lets hydration (which re-runs only once) land on top of it.
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

  const setPersistedSearchParams = useTraceFilterPersistence(searchParams, setSearchParams, {
    storageKey: isScoped ? `mastra:traces:saved-filters:${scopedEntityType}:${scopedEntityId}` : undefined,
  });
  const querySearchParams = new URLSearchParams(searchParams);
  querySearchParams.delete('listMode');
  if (querySearchParams.get('status') === 'running') querySearchParams.delete('status');
  // Drop params the query API can't run on, so no chip ever advertises a filter
  // that has no effect on the list.
  for (const field of TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS) {
    querySearchParams.delete(`filter${field[0]?.toUpperCase()}${field.slice(1)}`);
  }
  const url = useTraceUrlState(querySearchParams, setPersistedSearchParams);

  // Scope fields live in the URL (set by the scoping effect above) but never surface as chips.
  const scopedFieldIds = useMemo(() => new Set(isScoped ? ['rootEntityType', 'entityId'] : []), [isScoped]);
  const hiddenFieldIds = useMemo<readonly string[]>(
    () => (isScoped ? ['rootEntityType', 'entityId', 'entityName'] : []),
    [isScoped],
  );

  const [datasetDialogTarget, setDatasetDialogTarget] = useState<{
    traceId: string;
    rootSpanId: string | undefined;
  } | null>(null);
  const [addMocksTarget, setAddMocksTarget] = useState<{ traceId: string } | null>(null);
  // Trace whose side panel currently shows the full thread. Keyed by trace id so selecting
  // another trace (row click, prev/next) falls back to the trace panel without an effect.
  const [fullThreadTraceId, setFullThreadTraceId] = useState<string | null>(null);

  // Counts for the tab badges. The tab bodies own their pagination and re-use these
  // first-page queries through React Query's cache.
  const { data: traceFeedbackData } = useTraceFeedback({ traceId: url.traceIdParam });
  const { data: spanFeedbackData } = useSpanFeedback({ traceId: url.traceIdParam, spanId: url.spanIdParam });

  const {
    spans: traceSpans,
    anchorSpanId,
    isLoading: isLoadingTraceSpans,
  } = useTraceOrBranchSpans({
    traceId: url.traceIdParam ?? null,
    listMode: 'traces',
    anchorSpanId: null,
  });
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

  // Derived from URL + query data — no local state, so a span change (which clears scoreIdParam
  // in the URL) or a direct URL edit always resyncs ScoreDataPanel.
  const featuredScore = url.scoreIdParam ? spanScoresData?.scores?.find(s => s.id === url.scoreIdParam) : undefined;

  const { data: rootEntityNameSuggestions = [] } = useEntityNames({
    entityType: url.selectedEntityOption?.entityType as EntityType | undefined,
    rootOnly: true,
  });
  const { data: discoveredEnvironments = [] } = useEnvironments();

  const filterBarFields = useMemo(
    () => [
      TRACE_TIME_RANGE_FIELD,
      ...createTraceFilterBarFields({
        availableRootEntityNames: rootEntityNameSuggestions,
        availableEnvironments: discoveredEnvironments,
        hiddenFieldIds,
      }),
    ],
    [rootEntityNameSuggestions, discoveredEnvironments, hiddenFieldIds],
  );
  const allFilterBarItems = useMemo(() => traceTokensToFilterBarItems(url.filterTokens), [url.filterTokens]);
  const filterBarItems = useMemo(
    () => allFilterBarItems.filter(item => !scopedFieldIds.has(item.fieldId)),
    [allFilterBarItems, scopedFieldIds],
  );
  // The time-range chip is a synthetic, always-present item so it takes part in keyboard
  // navigation; it never round-trips to filter tokens (its state lives in the date params).
  const filterBarValue = useMemo(() => [TRACE_TIME_RANGE_ITEM, ...filterBarItems], [filterBarItems]);
  // Re-inject the hidden scope items so `FilterBar.Clear` (which emits `[]`) and any other
  // edit can never drop the scope from the URL.
  const handleFilterBarChange = useCallback(
    (items: FilterBarItem[]) => {
      const scoped = allFilterBarItems.filter(item => scopedFieldIds.has(item.fieldId));
      const rest = items.filter(item => item.fieldId !== TRACE_TIME_RANGE_FIELD_ID);
      url.handleFilterTokensChange(filterBarItemsToTraceTokens([...scoped, ...rest]));
    },
    [allFilterBarItems, scopedFieldIds, url],
  );

  const {
    rows: traces,
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: tracesError,
    autoRefetch: autoRefetchTraces,
    setAutoRefetch: setAutoRefetchTraces,
  } = useTracesListSource({
    rolling: !url.selectedDateTo,
    query: now =>
      buildTraceQueryRequest({
        rootEntityType: url.selectedEntityOption?.entityType,
        status: url.selectedStatus,
        dateFrom: url.selectedDateFrom,
        dateTo: url.selectedDateTo,
        tokens: url.filterTokens,
        now,
      }),
  });
  const traceColumns = useTraceColumnPreferences();
  const observabilityCapabilities = useObservabilityStorageCapabilities();
  const usageDisabledReason = observabilityCapabilities.isLoading
    ? 'Checking whether this storage supports usage data.'
    : !observabilityCapabilities.supportsMetrics
      ? 'This observability store does not support token and cost metrics.'
      : undefined;
  const usageColumnsUnavailable = !observabilityCapabilities.isLoading && !observabilityCapabilities.supportsMetrics;
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
  const { handlePreviousTrace, handleNextTrace } = useTraceListNavigation(
    traces,
    url.traceIdParam,
    null,
    url.handleTraceClick,
  );

  // Tool mocks only make sense for agent runs — gate the "Add tool mocks to item" action
  // on the displayed root/anchor span being an agent.
  const isAgentTrace = anchorSpan?.entityType === 'agent';
  // The side panel widens per column shown: Messages (agent turn) and/or span detail.
  const hasMessagesColumn = !!getTraceThreadId(anchorSpan, anchorSpanId ?? undefined);
  const hasDetailColumn = !!url.spanIdParam || !!featuredScore;
  // The full thread view embeds its own columns (messages, spans, span detail), so it takes the whole frame.
  const isFullThreadOpen = !!url.traceIdParam && fullThreadTraceId === url.traceIdParam;
  const sidePanelWidth =
    isFullThreadOpen || (hasMessagesColumn && hasDetailColumn)
      ? 'full'
      : hasMessagesColumn || hasDetailColumn
        ? 'wide'
        : 'half';

  const filtersApplied =
    !!url.selectedEntityOption ||
    !!url.selectedStatus ||
    url.filterTokens.length > 0 ||
    url.datePreset !== 'last-7d' ||
    !!url.selectedDateTo;

  const toolbarControls = (
    <>
      <FilterBar
        fields={filterBarFields}
        operators={TRACE_FILTER_BAR_OPERATORS}
        value={filterBarValue}
        onValueChange={handleFilterBarChange}
        aria-label="Trace filters"
        className="min-w-64 flex-1"
      >
        <TraceTimeRangeChip
          preset={url.datePreset}
          onPresetChange={url.handleDatePresetChange}
          dateFrom={url.selectedDateFrom}
          dateTo={url.selectedDateTo}
          onDateChange={url.handleDateChange}
          onDateRangeChange={url.handleDateRangeChange}
          disabled={isTracesLoading}
          presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
        />
        {filterBarItems.map(item => (
          <FilterBar.Chip key={item.id} item={item} />
        ))}
        <FilterBar.Input placeholder="Filter traces…" />
        {filterBarItems.length > 0 && <FilterBar.Clear />}
      </FilterBar>
      <div className="min-h-form-md ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
        <TraceColumnsMenu
          preferences={traceColumns.preferences}
          usageDisabledReason={usageDisabledReason}
          onToggleColumn={traceColumns.toggleColumn}
          onAddMetadataColumn={traceColumns.addMetadataColumn}
          onRemoveMetadataColumn={traceColumns.removeMetadataColumn}
          onReset={traceColumns.resetColumns}
        />
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

  const pageTopArea = (
    <PageLayout.TopArea>
      <PageLayout.Row>
        <PageLayout.Column className="flex w-full flex-wrap items-start justify-start gap-2">
          {toolbarControls}
        </PageLayout.Column>
      </PageLayout.Row>
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
        sidePanelWidth={sidePanelWidth}
        listSlot={
          <TracesListView
            traces={traces}
            isLoading={isTracesLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            setEndOfListElement={setEndOfListElement}
            filtersApplied={filtersApplied}
            featuredTraceId={url.traceIdParam}
            isBranchesMode={url.listMode === 'branches'}
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
              onClose={() => {
                setFullThreadTraceId(null);
                url.handleTraceClose();
              }}
              isFullThreadOpen={isFullThreadOpen}
              onFullThreadOpenChange={open => setFullThreadTraceId(open ? (url.traceIdParam ?? null) : null)}
              onSpanSelect={id => url.handleSpanChange(id ?? null)}
              onSpanClose={url.handleSpanClose}
              onSaveAsDatasetItem={args => setDatasetDialogTarget(args)}
              onAddTraceMocksToItem={isAgentTrace ? args => setAddMocksTarget(args) : undefined}
              initialSpanId={url.spanIdParam}
              onPrevious={handlePreviousTrace}
              onNext={handleNextTrace}
              showPartialThread
              featuredSpanIds={url.highlightSpanIdsParam}
              onHighlightSpans={url.handleHighlightSpans}
              feedbackTabBadge={<NeedsReviewDot feedback={traceFeedbackData?.feedback} />}
              feedbackTabSlot={({ traceId: tid }) => <TraceFeedbackTab traceId={tid} />}
              scorePanelSlot={
                featuredScore ? (
                  <ScoreDataPanel
                    className="rounded-none border-0 bg-transparent"
                    score={featuredScore}
                    onClose={() => url.handleScoreChange(null)}
                  />
                ) : undefined
              }
              scoresTabBadge={spanScoresData?.pagination?.total ?? undefined}
              scoresTabSlot={({ traceId: tid, rootSpanId }) =>
                rootSpanId ? (
                  <TraceScoresTab traceId={tid} spanId={rootSpanId} onScoreSelect={url.handleScoreChange} />
                ) : null
              }
              spanActiveTab={url.spanTabParam ?? 'details'}
              onSpanTabChange={tab => url.handleSpanTabChange(tab as SpanTab)}
              spanFeedbackTabBadge={<NeedsReviewDot feedback={spanFeedbackData?.feedback} />}
              spanFeedbackTabSlot={({ traceId: tid, spanId: sid }) =>
                tid && sid ? <SpanFeedbackTab key={`${tid}:${sid}`} traceId={tid} spanId={sid} /> : null
              }
              spanPanelClassName="rounded-none border-0 bg-transparent"
            />
          ) : null
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
