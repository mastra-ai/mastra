import {
  MainHeader,
  LogsList,
  LogsToolbar,
  isValidLogsDatePreset,
  useLogsFilters,
  useExperimentalFeatures,
  EntityListPageLayout,
} from '@mastra/playground-ui';
import type { FeaturedIds } from '@mastra/playground-ui';
import { LogsIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useLogs } from '@/domains/logs/hooks/use-logs';

const PERIOD_PARAM = 'period';
const LOG_PARAM = 'logId';
const TRACE_PARAM = 'traceId';
const SPAN_PARAM = 'spanId';

export default function Logs() {
  const { experimentalFeaturesEnabled } = useExperimentalFeatures();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPreset = searchParams.get(PERIOD_PARAM);
  const datePreset = isValidLogsDatePreset(urlPreset) ? urlPreset : '24h';

  const featuredLogId = searchParams.get(LOG_PARAM);
  const featuredTraceId = searchParams.get(TRACE_PARAM);
  const featuredSpanId = searchParams.get(SPAN_PARAM);

  const handleTimePeriodChange = useCallback(
    (preset: string) => {
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

  const { data: logs = [] } = useLogs();

  const {
    searchQuery,
    setSearchQuery,
    filterGroups,
    filterColumns,
    toggleComparator,
    removeFilterGroup,
    clearAllFilters,
    filteredLogs,
  } = useLogsFilters(logs);

  if (!experimentalFeaturesEnabled) {
    return null;
  }

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
        />
      </EntityListPageLayout.Top>

      <LogsList
        logs={filteredLogs}
        hasActiveFilters={searchQuery.length > 0 || filterGroups.length > 0}
        featuredLogId={featuredLogId}
        featuredTraceId={featuredTraceId}
        featuredSpanId={featuredSpanId}
        onFeaturedChange={handleFeaturedChange}
      />
    </EntityListPageLayout>
  );
}
