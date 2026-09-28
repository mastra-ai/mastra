import type { EntityType } from '@mastra/core/observability';
import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import { useTraceQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import { LogDataPanel } from '@mastra/playground-ui/domains/logs/components/log-data-panel';
import { LogsErrorContent } from '@mastra/playground-ui/domains/logs/components/logs-error-content';
import { LogsListView } from '@mastra/playground-ui/domains/logs/components/logs-list-view';
import { LogsToolbar } from '@mastra/playground-ui/domains/logs/components/logs-toolbar';
import { NoLogsInfo } from '@mastra/playground-ui/domains/logs/components/no-logs-info';
import { useLogs } from '@mastra/playground-ui/domains/logs/hooks/use-logs';
import { useLogsFilterPersistence } from '@mastra/playground-ui/domains/logs/hooks/use-logs-filter-persistence';
import { useLogsListNavigation } from '@mastra/playground-ui/domains/logs/hooks/use-logs-list-navigation';
import { useLogsUrlState } from '@mastra/playground-ui/domains/logs/hooks/use-logs-url-state';
import {
  buildLogsListFilters,
  createLogsPropertyFilterFields,
  neutralizeLogsFilterTokens,
} from '@mastra/playground-ui/domains/logs/log-filters';
import { useEntityNames } from '@mastra/playground-ui/domains/traces/hooks/use-entity-names';
import { useEnvironments } from '@mastra/playground-ui/domains/traces/hooks/use-environments';
import { useServiceNames } from '@mastra/playground-ui/domains/traces/hooks/use-service-names';
import { useTags } from '@mastra/playground-ui/domains/traces/hooks/use-tags';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';

const crumbs = [navCrumb('/logs')];

const LOGS_SORT_KEYS = ['timestamp'] as const;
const DEFAULT_LOGS_SORT = { key: 'timestamp', direction: 'desc' } as const;

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const url = useLogsUrlState(searchParams, setSearchParams);
  // Servers without the trace-query API list threads through `listTracesLight` and don't expose feedback.
  const traceQuery = useTraceQueryAvailable();
  const { sort, onSortChange } = useUrlSort({
    searchParams,
    setSearchParams,
    allowedKeys: LOGS_SORT_KEYS,
    defaultSort: DEFAULT_LOGS_SORT,
  });
  const orderBy = useMemo(
    () => ({
      field: 'timestamp' as const,
      direction: sort?.direction === 'asc' ? ('ASC' as const) : ('DESC' as const),
    }),
    [sort?.direction],
  );
  const persistence = useLogsFilterPersistence(searchParams, setSearchParams);

  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();

  const { data: availableTags = [], isPending: isTagsLoading } = useTags();
  const { data: rootEntityNameSuggestions = [], isPending: isEntityNamesLoading } = useEntityNames({
    entityType: url.selectedEntityOption?.entityType as EntityType | undefined,
    rootOnly: true,
  });
  const { data: discoveredEnvironments = [], isPending: isEnvironmentsLoading } = useEnvironments();
  const { data: discoveredServiceNames = [], isPending: isServiceNamesLoading } = useServiceNames();

  const filterFields = useMemo(
    () =>
      createLogsPropertyFilterFields({
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

  const logsFilters = useMemo(
    () =>
      buildLogsListFilters({
        rootEntityType: url.selectedEntityOption?.entityType as EntityType | undefined,
        dateFrom: url.selectedDateFrom,
        dateTo: url.selectedDateTo,
        tokens: url.filterTokens,
      }),
    [url.filterTokens, url.selectedDateFrom, url.selectedDateTo, url.selectedEntityOption],
  );

  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    error: logsError,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useLogs({ filters: logsFilters, orderBy });

  const { logIdMap, featuredLog, handleLogClick, handlePreviousLog, handleNextLog } = useLogsListNavigation(
    logs,
    url.featuredLogId,
    url.handleFeaturedChange,
    url.featuredTraceId,
  );

  const { data: traceSpansData, isLoading: isLoadingTraceSpans } = useTraceSpans(url.featuredTraceId ?? null);

  const handleClear = useCallback(
    () => url.applyFilterTokens(neutralizeLogsFilterTokens(filterFields, url.filterTokens)),
    [filterFields, url],
  );

  const handleLogClose = useCallback(() => url.handleFeaturedChange({ logId: null }), [url]);
  const handleTraceClick = useCallback((traceId: string) => url.handleFeaturedChange({ traceId, spanId: null }), [url]);
  const handleSpanClick = useCallback(
    (traceId: string, spanId: string) => url.handleFeaturedChange({ traceId, spanId }),
    [url],
  );
  const handleTraceClose = useCallback(() => url.handleFeaturedChange({ traceId: null, spanId: null }), [url]);
  const handleSpanSelect = useCallback(
    (spanId: string | undefined) => url.handleFeaturedChange({ spanId: spanId ?? null }),
    [url],
  );

  const actionRow = (
    <>
      <ActionRow>
        <ActionRow.Start>
          <DateTimeRangePicker
            preset={url.datePreset}
            onPresetChange={url.handleDatePresetChange}
            dateFrom={url.selectedDateFrom}
            dateTo={url.selectedDateTo}
            onDateChange={url.handleDateChange}
            disabled={isLoadingLogs}
            presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
          />
          <PropertyFilterCreator
            fields={filterFields}
            tokens={url.filterTokens}
            onTokensChange={url.handleFilterTokensChange}
            disabled={isLoadingLogs}
            onStartTextFilter={setAutoFocusFilterFieldId}
          />
        </ActionRow.Start>
      </ActionRow>

      <LogsToolbar
        isLoading={isLoadingLogs}
        filterFields={filterFields}
        filterTokens={url.filterTokens}
        onFilterTokensChange={url.handleFilterTokensChange}
        onClear={handleClear}
        onRemoveAll={url.handleRemoveAll}
        onSave={persistence.handleSave}
        onRemoveSaved={persistence.hasSavedFilters ? persistence.handleRemoveSaved : undefined}
        autoFocusFilterFieldId={autoFocusFilterFieldId}
      />
    </>
  );

  if (logsError) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} actionRow={actionRow}>
        <h1 className="sr-only">Logs</h1>
        <div className="flex h-full items-center justify-center">
          <LogsErrorContent error={logsError} resource="logs" errorTitle="Failed to load logs" />
        </div>
      </PageLayout>
    );
  }

  const contentFiltersApplied = !!url.selectedEntityOption || url.filterTokens.length > 0;

  if (logs.length === 0 && !isLoadingLogs && !contentFiltersApplied) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} actionRow={actionRow}>
        <h1 className="sr-only">Logs</h1>
        <NoLogsInfo datePreset={url.datePreset} dateFrom={url.selectedDateFrom} dateTo={url.selectedDateTo} />
      </PageLayout>
    );
  }

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} actionRow={actionRow}>
      <h1 className="sr-only">Logs</h1>
      <LogsListView
        logs={logs}
        isLoading={isLoadingLogs}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        logIdMap={logIdMap}
        featuredLogId={url.featuredLogId}
        onLogClick={handleLogClick}
        timestampSort={sort?.direction}
        onSortChange={onSortChange}
      />
      <LogDataPanel
        log={featuredLog ?? undefined}
        onClose={handleLogClose}
        onTraceClick={handleTraceClick}
        onSpanClick={handleSpanClick}
        onPrevious={handlePreviousLog}
        onNext={handleNextLog}
      />
      <TraceSpanPanel
        depth={2}
        traceId={featuredLog ? (url.featuredTraceId ?? undefined) : undefined}
        spans={traceSpansData?.spans}
        isLoadingSpans={isLoadingTraceSpans}
        selectedSpanId={url.featuredSpanId ?? null}
        onSpanSelect={handleSpanSelect}
        onClose={handleTraceClose}
        withQueryTrace={traceQuery.enabled}
        withFeedback={traceQuery.enabled}
      />
    </PageLayout>
  );
}
