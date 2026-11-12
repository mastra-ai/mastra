import type { EntityType } from '@mastra/core/observability';
import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import { LogDataPanel } from '@mastra/playground-ui/domains/logs/components/log-data-panel';
import { LogsErrorContent } from '@mastra/playground-ui/domains/logs/components/logs-error-content';
import { LogsListView } from '@mastra/playground-ui/domains/logs/components/logs-list-view';
import { LogsToolbar } from '@mastra/playground-ui/domains/logs/components/logs-toolbar';
import { NoLogsInfo } from '@mastra/playground-ui/domains/logs/components/no-logs-info';
import { useLogsListNavigation } from '@mastra/playground-ui/domains/logs/hooks/use-logs-list-navigation';
import { useLogsUrlState } from '@mastra/playground-ui/domains/logs/hooks/use-logs-url-state';
import {
  DEFAULT_LOGS_SORT,
  LOGS_SORT_FIELDS,
  buildLogsListFilters,
  createLogsPropertyFilterFields,
  neutralizeLogsFilterTokens,
} from '@mastra/playground-ui/domains/logs/log-filters';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import type { SetURLSearchParamsLike } from '@mastra/playground-ui/sort/use-url-sort';
import { useLogs } from '@mastra/react/hooks/logs';
import { useEntityNames, useEnvironments, useServiceNames, useTags } from '@mastra/react/hooks/traces';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, AskButton } from '../../shared/host';
import { TraceView } from '../../shared/trace-view';

/** A log as one line, with its data clipped, for the model. */
function describeLog(log: {
  timestamp: unknown;
  level: string;
  message: string;
  data?: unknown;
  traceId?: string | null;
}) {
  const data = log.data ? JSON.stringify(log.data, (key, value: unknown) => (key === 'stack' ? undefined : value)) : '';
  return [
    `${log.level} log from ${new Date(String(log.timestamp)).toISOString()}: "${log.message.slice(0, 300)}"`,
    data && data !== '{}' ? `data ${data.slice(0, 500)}` : undefined,
    log.traceId ? `trace ${log.traceId}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Studio keeps the logs page's state in the URL; the app keeps the same params in memory. */
function useSearchParamsState(initial: string): [URLSearchParams, SetURLSearchParamsLike] {
  const [params, setParams] = useState(() => new URLSearchParams(initial));
  const set = useCallback<SetURLSearchParamsLike>(
    next => setParams(prev => new URLSearchParams(typeof next === 'function' ? next(prev) : next)),
    [],
  );
  return [params, set];
}

/**
 * Studio's logs page: time range, property filters, the log list with paging and sort, and the log panel.
 * Opening a log's trace draws it with the trace viewer's timeline. Filters aren't saved between visits, since
 * hosts sandbox apps away from storage.
 */
export function LogsTab({ app, initialParams, banner }: { app: App; initialParams: string; banner?: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParamsState(initialParams);
  const url = useLogsUrlState(searchParams, setSearchParams);
  const { sort, onSortChange } = useUrlSort({
    searchParams,
    setSearchParams,
    allowedKeys: LOGS_SORT_FIELDS,
    defaultSort: DEFAULT_LOGS_SORT,
  });
  const orderBy = useMemo(
    () => ({
      field: 'timestamp' as const,
      direction: sort?.direction === 'asc' ? ('ASC' as const) : ('DESC' as const),
    }),
    [sort?.direction],
  );
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
  } = useLogs({ filters: logsFilters, orderBy });

  const { logIdMap, featuredLog, handleLogClick, handlePreviousLog, handleNextLog } = useLogsListNavigation(
    logs,
    url.featuredLogId,
    url.handleFeaturedChange,
    url.featuredTraceId,
  );

  const handleClear = useCallback(
    () => url.applyFilterTokens(neutralizeLogsFilterTokens(filterFields, url.filterTokens)),
    [filterFields, url],
  );

  if (url.featuredTraceId) {
    return (
      <TraceView
        app={app}
        traceId={url.featuredTraceId}
        spanId={url.featuredSpanId ?? undefined}
        backLabel="Back to the logs"
        onBack={() => url.handleFeaturedChange({ traceId: null, spanId: null })}
      />
    );
  }

  const log = featuredLog ? describeLog(featuredLog) : undefined;
  const contentFiltersApplied = !!url.selectedEntityOption || url.filterTokens.length > 0;
  let body: ReactNode;
  if (logsError) {
    body = (
      <div className="flex h-full items-center justify-center">
        <LogsErrorContent error={logsError} resource="logs" errorTitle="Failed to load logs" />
      </div>
    );
  } else if (logs.length === 0 && !isLoadingLogs && !contentFiltersApplied) {
    body = <NoLogsInfo datePreset={url.datePreset} dateFrom={url.selectedDateFrom} dateTo={url.selectedDateTo} />;
  } else {
    body = (
      <div className="flex min-h-0 flex-1">
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
          onClose={() => url.handleFeaturedChange({ logId: null })}
          onTraceClick={traceId => url.handleFeaturedChange({ traceId, spanId: null })}
          onSpanClick={(traceId, spanId) => url.handleFeaturedChange({ traceId, spanId })}
          onPrevious={handlePreviousLog}
          onNext={handleNextLog}
          actions={log && <AskButton label="Ask about this log" prompt={`Look into this ${log}. What caused it?`} />}
        />
      </div>
    );
  }

  const filters = new URLSearchParams(searchParams);
  filters.delete('logId');
  const context = [
    `The logs list's filters, as Studio URL params: ${filters.toString() || 'none'}.`,
    log && `The log open in the side panel is the ${log}.`,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <AppState context={context} studioPath={`/logs?${searchParams}`}>
      <div className="flex h-full min-h-0 flex-col">
        {banner}
        <div className="flex flex-col gap-2 p-3">
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
                size="sm"
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
            autoFocusFilterFieldId={autoFocusFilterFieldId}
          />
        </div>
        {body}
      </div>
    </AppState>
  );
}
