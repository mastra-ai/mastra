import type { SpanRecord } from '@mastra/core/storage';
import { LogsDataList, LogsDataListSkeleton, cn } from '@mastra/playground-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LogRecord } from '../types';
import { LogDetails } from './log-details';
import { SpanDetails } from './span-details';
import { TraceDetails } from './trace-details';

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function getLogIds(logs: LogRecord[]): Map<LogRecord, string> {
  const ids = new Map<LogRecord, string>();
  const seen = new Map<string, number>();
  for (const log of logs) {
    const ts = log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp;
    const base = hashCode(`${ts}${log.message ?? ''}${log.data ? JSON.stringify(log.data) : ''}`);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    ids.set(log, count > 0 ? `${base}-${count}` : base);
  }
  return ids;
}

const COLUMNS = 'auto auto auto auto minmax(5rem,1fr) minmax(5rem,1fr)';

export interface FeaturedIds {
  logId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
}

export interface LogsListProps {
  logs: LogRecord[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  featuredLogId?: string | null;
  featuredTraceId?: string | null;
  featuredSpanId?: string | null;
  onFeaturedChange?: (ids: FeaturedIds) => void;
}

export function LogsList({
  logs,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  featuredLogId: controlledLogId,
  featuredTraceId: controlledTraceId,
  featuredSpanId: controlledSpanId,
  onFeaturedChange,
}: LogsListProps) {
  // Internal state fallback for uncontrolled usage
  const [internalIds, setInternalIds] = useState<FeaturedIds>({});

  const featuredLogId = controlledLogId ?? internalIds.logId ?? null;
  const featuredTraceId = controlledTraceId ?? internalIds.traceId ?? null;
  const featuredSpanId = controlledSpanId ?? internalIds.spanId ?? null;

  const updateFeatured = useCallback(
    (ids: FeaturedIds) => {
      const merged = {
        logId: ids.logId !== undefined ? ids.logId : featuredLogId,
        traceId: ids.traceId !== undefined ? ids.traceId : featuredTraceId,
        spanId: ids.spanId !== undefined ? ids.spanId : featuredSpanId,
      };
      if (onFeaturedChange) {
        onFeaturedChange(merged);
      } else {
        setInternalIds(merged);
      }
    },
    [onFeaturedChange, featuredLogId, featuredTraceId, featuredSpanId],
  );

  // SpanRecord cached from TraceDetails callback (needed for SpanDetails rendering)
  const [featuredSpanRecord, setFeaturedSpanRecord] = useState<SpanRecord | undefined>();
  const [logDetailsCollapsed, setLogDetailsCollapsed] = useState(false);

  // Clear cached span when controlled spanId is removed or changed
  useEffect(() => {
    if (!featuredSpanId || (featuredSpanRecord && featuredSpanRecord.spanId !== featuredSpanId)) {
      setFeaturedSpanRecord(undefined);
    }
  }, [featuredSpanId, featuredSpanRecord]);

  const logIdMap = useMemo(() => getLogIds(logs), [logs]);
  const idToLog = useMemo(() => {
    const m = new Map<string, { log: LogRecord; idx: number }>();
    for (let i = 0; i < logs.length; i++) {
      const id = logIdMap.get(logs[i]);
      if (id) m.set(id, { log: logs[i], idx: i });
    }
    return m;
  }, [logs, logIdMap]);

  const entry = featuredLogId ? idToLog.get(featuredLogId) : undefined;
  const featuredLogIdx = entry?.idx ?? -1;
  const featuredLog = featuredLogIdx >= 0 ? logs[featuredLogIdx] : null;

  const handlePreviousLog =
    featuredLogIdx > 0
      ? () => {
          const prevLog = logs[featuredLogIdx - 1];
          const id = logIdMap.get(prevLog)!;
          if (featuredTraceId) {
            updateFeatured({ logId: id, traceId: prevLog.traceId ?? null, spanId: null });
            setFeaturedSpanRecord(undefined);
          } else {
            updateFeatured({ logId: id });
          }
        }
      : undefined;

  const handleNextLog =
    featuredLogIdx >= 0 && featuredLogIdx < logs.length - 1
      ? () => {
          const nextLog = logs[featuredLogIdx + 1];
          const id = logIdMap.get(nextLog)!;
          if (featuredTraceId) {
            updateFeatured({ logId: id, traceId: nextLog.traceId ?? null, spanId: null });
            setFeaturedSpanRecord(undefined);
          } else {
            updateFeatured({ logId: id });
          }
        }
      : undefined;

  const handleLogClick = useCallback(
    (log: LogRecord) => {
      const id = logIdMap.get(log)!;
      if (featuredLogId === id) {
        updateFeatured({ logId: null });
        return;
      }
      if (featuredTraceId) {
        // Sync trace panel to new log's trace, or close it
        updateFeatured({ logId: id, traceId: log.traceId ?? null, spanId: null });
        setFeaturedSpanRecord(undefined);
      } else {
        updateFeatured({ logId: id });
      }
    },
    [featuredLogId, featuredTraceId, updateFeatured, logIdMap],
  );

  const handleTraceClick = useCallback(
    (traceId: string) => {
      updateFeatured({ traceId, spanId: null });
      setFeaturedSpanRecord(undefined);
    },
    [updateFeatured],
  );

  const handleSpanClick = useCallback(
    (traceId: string, spanId: string) => {
      updateFeatured({ traceId, spanId });
    },
    [updateFeatured],
  );

  const handleTraceClose = useCallback(() => {
    updateFeatured({ traceId: null, spanId: null });
    setLogDetailsCollapsed(false);
    setFeaturedSpanRecord(undefined);
  }, [updateFeatured]);

  const handleSpanSelect = useCallback(
    (span: SpanRecord | undefined) => {
      updateFeatured({ spanId: span?.spanId ?? null });
      setFeaturedSpanRecord(span);
    },
    [updateFeatured],
  );

  const handleSpanClose = useCallback(() => {
    updateFeatured({ spanId: null });
    setFeaturedSpanRecord(undefined);
  }, [updateFeatured]);

  const handleLogClose = useCallback(() => {
    updateFeatured({ logId: null });
  }, [updateFeatured]);

  if (isLoading) {
    return <LogsDataListSkeleton columns={COLUMNS} />;
  }

  const hasSidePanel = !!featuredLog;

  return (
    <div
      className={cn('grid h-full min-h-0 gap-4 items-start', hasSidePanel ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]')}
    >
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
            const id = logIdMap.get(log)!;
            const isFeatured = id === featuredLogId;

            return (
              <LogsDataList.RowButton
                key={id}
                onClick={() => handleLogClick(log)}
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

      {featuredLog && (
        <div
          className={cn(
            'grid gap-4 h-full overflow-auto ',
            logDetailsCollapsed && featuredTraceId && featuredSpanRecord
              ? 'grid-rows-[auto_1fr_1fr]'
              : logDetailsCollapsed && featuredTraceId
                ? 'grid-rows-[auto_1fr]'
                : featuredTraceId && featuredSpanRecord
                  ? 'grid-rows-[1fr_1fr_1fr]'
                  : featuredTraceId
                    ? 'grid-rows-[1fr_1fr]'
                    : logDetailsCollapsed
                      ? 'grid-rows-[auto]'
                      : 'grid-rows-[1fr]',
          )}
        >
          <LogDetails
            log={featuredLog}
            onClose={handleLogClose}
            onTraceClick={handleTraceClick}
            onSpanClick={handleSpanClick}
            onPrevious={handlePreviousLog}
            onNext={handleNextLog}
            collapsed={logDetailsCollapsed}
            onCollapsedChange={setLogDetailsCollapsed}
          />

          {featuredTraceId && (
            <TraceDetails
              traceId={featuredTraceId}
              onClose={handleTraceClose}
              onSpanSelect={handleSpanSelect}
              initialSpanId={featuredSpanId}
            />
          )}
          {featuredSpanRecord && <SpanDetails span={featuredSpanRecord} onClose={handleSpanClose} />}
        </div>
      )}
    </div>
  );
}
