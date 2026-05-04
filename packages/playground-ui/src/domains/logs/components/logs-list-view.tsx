import type { LogRecord } from '../types';
import { LogsDataList, LogsDataListSkeleton } from '@/ds/components/LogsDataList';
import { cn } from '@/lib/utils';

const COLUMNS = 'auto auto auto auto minmax(5rem,1fr) minmax(5rem,1fr)';

export interface LogsListViewProps {
  logs: LogRecord[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  /** Stable per-render id for each log — used for React keys and for matching against `featuredLogId`.
   *  Build with `useLogsListNavigation`. */
  logIdMap: Map<LogRecord, string>;
  /** Currently featured/selected log — its row gets the highlighted background. */
  featuredLogId?: string | null;
  /** Called when a row is clicked. The current toggle + trace-sync logic is the consumer's call. */
  onLogClick: (log: LogRecord) => void;
}

/**
 * Pure presentational list. Renders the LogsDataList primitive with rows, empty state, and
 * infinite-paging loader. Owns no state and fetches no data.
 */
export function LogsListView({
  logs,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  logIdMap,
  featuredLogId,
  onLogClick,
}: LogsListViewProps) {
  if (isLoading) {
    return <LogsDataListSkeleton columns={COLUMNS} />;
  }

  return (
    <LogsDataList columns={COLUMNS} className="min-w-0">
      <LogsDataList.Top>
        <LogsDataList.TopCell>Date</LogsDataList.TopCell>
        <LogsDataList.TopCell>Time</LogsDataList.TopCell>
        <LogsDataList.TopCell>Level</LogsDataList.TopCell>
        <LogsDataList.TopCell>Entity</LogsDataList.TopCell>
        <LogsDataList.TopCell>Message</LogsDataList.TopCell>
        <LogsDataList.TopCell>Data</LogsDataList.TopCell>
      </LogsDataList.Top>

      {logs.length === 0 ? (
        <LogsDataList.NoMatch message="No logs match your search" />
      ) : (
        logs.map(log => {
          const id = logIdMap.get(log);
          // Defensive: consumer is expected to build `logIdMap` from the same `logs` list
          // (via `useLogsListNavigation`), but if they drift we'd rather drop the row than
          // ship a missing-key warning and broken selection highlighting.
          if (!id) return null;
          const isFeatured = id === featuredLogId;

          return (
            <LogsDataList.RowButton
              key={id}
              onClick={() => onLogClick(log)}
              className={cn(isFeatured && 'bg-surface4')}
            >
              <LogsDataList.DateCell timestamp={log.timestamp} />
              <LogsDataList.TimeCell timestamp={log.timestamp} />
              <LogsDataList.LevelCell level={log.level} />
              <LogsDataList.EntityCell entityType={log.entityType} entityName={log.entityName} />
              <LogsDataList.MessageCell message={log.message} />
              <LogsDataList.DataCell data={log.data} />
            </LogsDataList.RowButton>
          );
        })
      )}
      <LogsDataList.NextPageLoading
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />
    </LogsDataList>
  );
}
