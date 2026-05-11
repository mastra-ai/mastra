import {
  ButtonWithTooltip,
  ColumnsConfigurator,
  DateTimeRangePicker,
  LogDetailsView,
  LogsDataList,
  LogsErrorContent,
  LogsLayout,
  LogsListView,
  LogsToolbar,
  NoLogsInfo,
  PageHeader,
  PageLayout,
  PropertyFilterCreator,
  SpanDetailsView,
  TraceDetailsView,
  buildLogsListFilters,
  buildVisibleColumnDefs,
  createLogsPropertyFilterFields,
  neutralizeLogsFilterTokens,
  useColumnPreferences,
  useCustomColumns,
  useEntityNames,
  useEnvironments,
  useLogs,
  useLogsFilterPersistence,
  useLogsListNavigation,
  useLogsUrlState,
  useServiceNames,
  useSpanDetail,
  useTags,
  useTraceLightSpans,
} from '@mastra/playground-ui';
import type { CustomColumnSource, LogRecord } from '@mastra/playground-ui';
import { BookIcon, LogsIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  ALL_BUILT_IN_LOG_COLUMN_DEFS,
  LOGS_COLUMN_CONFIGS,
  LOGS_COLUMN_NAMES,
  LOG_COLUMN_DEFS,
  LOG_CUSTOM_COLUMN_SOURCES,
  OPTIONAL_LOGS_COLUMN_CONFIGS,
  formatLogCellValue,
  resolveLogCustomColumnValue,
} from '@/domains/logs/components/log-columns';
import type { LogCustomColumnSource } from '@/domains/logs/components/log-columns';
import { useLogJsonKeys } from '@/domains/observability/hooks/use-log-json-keys';

const LOGS_COLUMNS_STORAGE_KEY = 'logs:columns:visible';
const LOGS_CUSTOM_COLUMNS_STORAGE_KEY = 'logs:columns:custom';
const LOGS_REQUIRED_COLUMNS = ['date'];

/**
 * Per-column grid sizes used by the virtualized list. Built-in columns use
 * fixed widths to avoid horizontal jitter as rows enter/leave the virtualizer
 * window; only flex columns expand. `other` is the fallback for optional
 * built-ins and custom columns.
 */
const LOGS_COLUMN_WIDTHS: Record<string, string> = {
  date: '6rem',
  time: '9rem',
  level: '5rem',
  entityId: '10rem',
  message: 'minmax(8rem,1fr)',
  data: 'minmax(8rem,1fr)',
  other: '10rem',
};

const CUSTOM_SOURCE_LABELS: Record<LogCustomColumnSource, string> = {
  metadata: 'Metadata',
  data: 'Data',
};

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const url = useLogsUrlState(searchParams, setSearchParams);
  const persistence = useLogsFilterPersistence(searchParams, setSearchParams);

  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();
  const [logDetailsCollapsed, setLogDetailsCollapsed] = useState(false);

  const [visibleColumnNames, setVisibleColumnNames] = useColumnPreferences(LOGS_COLUMNS_STORAGE_KEY, LOGS_COLUMN_NAMES);
  const { customColumns, addCustomColumn, removeCustomColumn } = useCustomColumns(LOGS_CUSTOM_COLUMNS_STORAGE_KEY);

  // Autocomplete hints come from the backend's project-wide distinct-keys discovery
  // (see /observability/discovery/log-keys). Same shape as the traces variant.
  const { data: discoveredMetadataKeys = [] } = useLogJsonKeys('metadata');
  const { data: discoveredDataKeys = [] } = useLogJsonKeys('data');

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

  const customColumnSources: CustomColumnSource[] = useMemo(
    () =>
      LOG_CUSTOM_COLUMN_SOURCES.map(id => ({
        id,
        label: CUSTOM_SOURCE_LABELS[id],
        discoveredKeys: id === 'metadata' ? discoveredMetadataKeys : discoveredDataKeys,
      })),
    [discoveredMetadataKeys, discoveredDataKeys],
  );

  const visibleColumnDefs = useMemo(
    () =>
      buildVisibleColumnDefs<LogRecord>({
        visibleNames: visibleColumnNames,
        defaultDefs: LOG_COLUMN_DEFS,
        allBuiltInDefs: ALL_BUILT_IN_LOG_COLUMN_DEFS,
        customColumns,
        widths: LOGS_COLUMN_WIDTHS,
        customSources: LOG_CUSTOM_COLUMN_SOURCES,
        renderCustomCell: (log, source, key) => (
          <LogsDataList.MessageCell message={formatLogCellValue(resolveLogCustomColumnValue(log, source, key)) ?? ''} />
        ),
      }),
    [visibleColumnNames, customColumns],
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
        <PageLayout.Column>
          <PageHeader>
            <PageHeader.Title isLoading={isLoadingLogs}>
              <LogsIcon /> Logs
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
          <ColumnsConfigurator
            columns={LOGS_COLUMN_CONFIGS}
            optionalColumns={OPTIONAL_LOGS_COLUMN_CONFIGS}
            visibleColumns={visibleColumnNames}
            onVisibleColumnsChange={setVisibleColumnNames}
            requiredColumns={LOGS_REQUIRED_COLUMNS}
            customColumns={customColumns}
            customColumnSources={customColumnSources}
            onAddCustomColumn={addCustomColumn}
            onRemoveCustomColumn={removeCustomColumn}
            disabled={isLoadingLogs}
            defaultVisibleColumns={LOGS_COLUMN_NAMES}
          />
          <ButtonWithTooltip
            as="a"
            href="https://mastra.ai/en/docs/observability/logging"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Logs documentation"
            tooltipContent="Go to Logs documentation"
          >
            <BookIcon />
          </ButtonWithTooltip>
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
            columnDefs={visibleColumnDefs}
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
