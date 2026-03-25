import { useState } from 'react';
import type { LogRecord } from '../types';
import { LogDetails } from './log-details';
import { NoLogsInfo } from './no-logs-info';
import { ErrorState } from '@/ds/components/ErrorState';
import { LogsDataList, LogsDataListSkeleton } from '@/ds/components/LogsDataList';
import { cn } from '@/lib/utils';

export interface LogsListProps {
  logs: LogRecord[];
  isLoading?: boolean;
  error?: Error | null;
  hasActiveFilters?: boolean;
}

export function LogsList({ logs, isLoading, error, hasActiveFilters }: LogsListProps) {
  const [featuredLogIdx, setFeaturedLogIdx] = useState<number | null>(null);

  const featuredLog = featuredLogIdx !== null ? logs[featuredLogIdx] ?? null : null;

  if (error) {
    return <ErrorState title="Failed to load logs" message={error.message} />;
  }

  if (logs.length === 0 && !isLoading && !hasActiveFilters) {
    return <NoLogsInfo />;
  }

  if (isLoading) {
    return <LogsDataListSkeleton columns="auto auto auto minmax(160px,0.45fr) minmax(0,1fr)" />;
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      <LogsDataList
        columns={'auto auto auto minmax(auto,15rem) minmax(0,1fr)'}
        className="flex-1 min-w-0"
      >
        <LogsDataList.Top>
          <LogsDataList.TopCell>Date</LogsDataList.TopCell>
          <LogsDataList.TopCell>Time</LogsDataList.TopCell>
          <LogsDataList.TopCell>Level</LogsDataList.TopCell>
          <LogsDataList.TopCell>Entity</LogsDataList.TopCell>
          <LogsDataList.TopCell>Message</LogsDataList.TopCell>
        </LogsDataList.Top>

        {logs.length === 0 ? (
          <LogsDataList.NoMatch message="No logs match your search" />
        ) : (
          logs.map((log, idx) => {
            const isFeatured = idx === featuredLogIdx;

            return (
              <LogsDataList.RowButton
                key={`${log.traceId}-${log.spanId}-${idx}`}
                onClick={() => setFeaturedLogIdx(idx === featuredLogIdx ? null : idx)}
                className={cn(isFeatured && 'bg-surface4')}
              >
                <LogsDataList.DateCell timestamp={log.timestamp} />
                <LogsDataList.TimeCell timestamp={log.timestamp} />
                <LogsDataList.LevelCell level={log.level} />
                <LogsDataList.EntityCell entityType={log.entityType} entityName={log.entityName} />
                <LogsDataList.MessageCell message={log.message} />
              </LogsDataList.RowButton>
            );
          })
        )}
      </LogsDataList>

      {featuredLog && (
        <div className="w-[400px] shrink-0 bg-surface2 border border-border1 rounded-xl overflow-hidden">
          <LogDetails log={featuredLog} onClose={() => setFeaturedLogIdx(null)} />
        </div>
      )}
    </div>
  );
}
