import type { LogRecord, FeaturedIds, LogsDatePreset } from '@mastra/playground-ui';
import {
  MainHeader,
  LogsList,
  LogsToolbar,
  isValidLogsDatePreset,
  useLogsFilters,
  EntityListPageLayout,
} from '@mastra/playground-ui';
import { LogsIcon } from 'lucide-react';
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useLogs } from '@/domains/logs/hooks/use-logs';

const PERIOD_PARAM = 'period';
const LOG_PARAM = 'logId';
const TRACE_PARAM = 'traceId';
const SPAN_PARAM = 'spanId';

const PRESET_TO_MS: Record<LogsDatePreset, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '14d': 14 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export default function Logs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPreset = searchParams.get(PERIOD_PARAM);
  const datePreset = isValidLogsDatePreset(urlPreset) ? urlPreset : '24h';

  const featuredLogId = searchParams.get(LOG_PARAM);
  const featuredTraceId = searchParams.get(TRACE_PARAM);
  const featuredSpanId = searchParams.get(SPAN_PARAM);

  const handleTimePeriodChange = useCallback(
    (preset: LogsDatePreset) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === '24h') {
            next.delete(PERIOD_PARAM);
          } else {
            next.set(PERIOD_PARAM, preset);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleFeaturedChange = useCallback(
    (ids: FeaturedIds) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          for (const [field, value] of Object.entries(ids)) {
            const param = field === 'logId' ? LOG_PARAM : field === 'traceId' ? TRACE_PARAM : SPAN_PARAM;
            if (value) {
              next.set(param, value);
            } else {
              next.delete(param);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const logsFilters = useMemo(() => {
    const ms = PRESET_TO_MS[datePreset];
    if (!ms) return undefined;
    return { timestamp: { start: new Date(Date.now() - ms) } };
  }, [datePreset]);

  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    error: logsError,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useLogs({ filters: logsFilters });

  const {
    searchQuery,
    setSearchQuery,
    filterGroups,
    filterColumns,
    toggleComparator,
    removeFilterGroup,
    clearAllFilters,
    updateFilterGroups,
    filteredLogs,
  } = useLogsFilters(logs as LogRecord[]);

  return (
    <EntityListPageLayout className="max-w-none">
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title>
              <LogsIcon /> Logs
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>

        <LogsToolbar
          onSearchChange={setSearchQuery}
          datePreset={datePreset}
          onDatePresetChange={handleTimePeriodChange}
          filterGroups={filterGroups}
          filterColumns={filterColumns}
          onToggleComparator={toggleComparator}
          onRemoveFilterGroup={removeFilterGroup}
          onClearAllFilters={clearAllFilters}
          onFilterGroupsChange={updateFilterGroups}
          onReset={() => {
            setSearchQuery('');
            clearAllFilters();
            handleTimePeriodChange('24h');
          }}
          isLoading={isLoadingLogs}
          hasActiveFilters={searchQuery.length > 0 || filterGroups.length > 0 || datePreset !== '24h'}
        />
      </EntityListPageLayout.Top>

      <LogsList
        logs={filteredLogs}
        isLoading={isLoadingLogs}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        error={logsError instanceof Error ? logsError : null}
        hasActiveFilters={searchQuery.length > 0 || filterGroups.length > 0}
        featuredLogId={featuredLogId}
        featuredTraceId={featuredTraceId}
        featuredSpanId={featuredSpanId}
        onFeaturedChange={handleFeaturedChange}
      />
    </EntityListPageLayout>
  );
}
