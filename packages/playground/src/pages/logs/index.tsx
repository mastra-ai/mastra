import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import { LogDetailsView } from '@mastra/playground-ui/domains/logs/components/log-details-view';
import { LogsErrorContent } from '@mastra/playground-ui/domains/logs/components/logs-error-content';
import { LogsLayout } from '@mastra/playground-ui/domains/logs/components/logs-layout';
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
import { SpanDetailsView } from '@mastra/playground-ui/domains/traces/components/span-details-view';
import { TraceDetailsView } from '@mastra/playground-ui/domains/traces/components/trace-details-view';
import { useEntityNames } from '@mastra/playground-ui/domains/traces/hooks/use-entity-names';
import { useEnvironments } from '@mastra/playground-ui/domains/traces/hooks/use-environments';
import { useServiceNames } from '@mastra/playground-ui/domains/traces/hooks/use-service-names';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTags } from '@mastra/playground-ui/domains/traces/hooks/use-tags';
import { useTraceLightSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-light-spans';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const url = useLogsUrlState(searchParams, setSearchParams);
  const persistence = useLogsFilterPersistence(searchParams, setSearchParams);

  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();
  const [logDetailsCollapsed, setLogDetailsCollapsed] = useState(false);

  const { data: availableTags = [], isPending: isTagsLoading } = useTags();
  const { data: rootEntityNameSuggestions = [], isPending: isEntityNamesLoading } = useEntityNames({
    entityType: url.selectedEntityOption?.entityType,
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
        rootEntityType: url.selectedEntityOption?.entityType,
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
  } = useLogs({ filters: logsFilters });

  const { logIdMap, featuredLog, handleLogClick, handlePreviousLog, handleNextLog } = useLogsListNavigation(
    logs,
    url.featuredLogId,
    url.handleFeaturedChange,
    url.featuredTraceId,
  );

  const { data: lightSpansData, isLoading: isLoadingLightSpans } = useTraceLightSpans(url.featuredTraceId ?? null);
  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail(
    url.featuredTraceId ?? '',
    url.featuredSpanId ?? '',
  );

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
  const handleTraceClose = useCallback(() => {
    url.handleFeaturedChange({ traceId: null, spanId: null });
    setLogDetailsCollapsed(false);
  }, [url]);
  const handleSpanClose = useCallback(() => url.handleFeaturedChange({ spanId: null }), [url]);
  const handleSpanSelect = useCallback(
    (spanId: string | undefined) => url.handleFeaturedChange({ spanId: spanId ?? null }),
    [url],
  );

  const pageTopArea = (
    <PageLayout.TopArea>
      <PageLayout.Row>
        <PageLayout.Column className="flex flex-wrap items-start justify-start gap-2">
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
        </PageLayout.Column>
      </PageLayout.Row>

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
    </PageLayout.TopArea>
  );

  if (logsError) {
    return (
      <PageLayout width="wide" height="full">
        {pageTopArea}
        <PageLayout.MainArea isCentered>
          <LogsErrorContent error={logsError} resource="logs" errorTitle="Failed to load logs" />
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  const contentFiltersApplied = !!url.selectedEntityOption || url.filterTokens.length > 0;

  if (logs.length === 0 && !isLoadingLogs && !contentFiltersApplied) {
    return (
      <PageLayout width="wide" height="full">
        {pageTopArea}
        <PageLayout.MainArea isCentered>
          <NoLogsInfo datePreset={url.datePreset} dateFrom={url.selectedDateFrom} dateTo={url.selectedDateTo} />
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      {pageTopArea}
      <LogsLayout
        logCollapsed={logDetailsCollapsed}
        listSlot={
          <LogsListView
            logs={logs}
            isLoading={isLoadingLogs}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            setEndOfListElement={setEndOfListElement}
            logIdMap={logIdMap}
            featuredLogId={url.featuredLogId}
            onLogClick={handleLogClick}
          />
        }
        logPanelSlot={
          featuredLog ? (
            <LogDetailsView
              log={featuredLog}
              onClose={handleLogClose}
              onTraceClick={handleTraceClick}
              onSpanClick={handleSpanClick}
              onPrevious={handlePreviousLog}
              onNext={handleNextLog}
              collapsed={logDetailsCollapsed}
              onCollapsedChange={setLogDetailsCollapsed}
            />
          ) : null
        }
        tracePanelSlot={
          url.featuredTraceId ? (
            <TraceDetailsView
              traceId={url.featuredTraceId}
              spans={lightSpansData?.spans}
              isLoading={isLoadingLightSpans}
              onClose={handleTraceClose}
              onSpanSelect={handleSpanSelect}
              selectedSpanId={url.featuredSpanId}
            />
          ) : null
        }
        spanPanelSlot={
          url.featuredTraceId && url.featuredSpanId ? (
            <SpanDetailsView
              spanId={url.featuredSpanId}
              span={spanDetailData?.span}
              isLoading={isLoadingSpanDetail}
              onClose={handleSpanClose}
            />
          ) : null
        }
      />
    </PageLayout>
  );
}
