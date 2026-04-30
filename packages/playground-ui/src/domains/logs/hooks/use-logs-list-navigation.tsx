import { useCallback, useMemo } from 'react';
import type { LogRecord } from '../types';
import type { LogsFeaturedIds } from './use-logs-url-state';

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Prefer the storage-assigned `logId`. When absent, derive an id from immutable content fields
 *  (`timestamp + message + data`) so the same log lands on the same id across polls regardless
 *  of list order or insertions. Two logs without `logId` that hash identically share an id —
 *  acceptable because the URL-driven selection still resolves deterministically. */
function buildLogIds(logs: LogRecord[]): Map<LogRecord, string> {
  const ids = new Map<LogRecord, string>();
  for (const log of logs) {
    if (log.logId) {
      ids.set(log, log.logId);
      continue;
    }
    const ts = log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp;
    ids.set(log, hashCode(`${ts}${log.message ?? ''}${log.data ? JSON.stringify(log.data) : ''}`));
  }
  return ids;
}

export interface UseLogsListNavigationResult {
  /** Map each log in the list to its derived id. Pass to `<LogsListView logIdMap={...}>`. */
  logIdMap: Map<LogRecord, string>;
  /** Look up a log's id (undefined if not in the list). */
  getLogId: (log: LogRecord) => string | undefined;
  /** The currently featured log resolved from `featuredLogId`, or null. */
  featuredLog: LogRecord | null;
  /** Click handler that flips featured selection with toggle behavior, and — when a trace panel is
   *  open — syncs the trace panel to the new log's trace. Pass to `<LogsListView onLogClick={...}>`. */
  handleLogClick: (log: LogRecord) => void;
  /** Undefined when at the start of the list (disable the prev button). */
  handlePreviousLog: (() => void) | undefined;
  /** Undefined when at the end of the list (disable the next button). */
  handleNextLog: (() => void) | undefined;
}

/**
 * Derives id mapping + featured log + prev/next/click handlers for a logs list. Stateless — only
 * reads from the inputs and calls `onFeaturedChange` on selection changes.
 */
export function useLogsListNavigation(
  logs: LogRecord[],
  featuredLogId: string | null,
  onFeaturedChange: (ids: LogsFeaturedIds) => void,
  featuredTraceId?: string | null,
): UseLogsListNavigationResult {
  const logIdMap = useMemo(() => buildLogIds(logs), [logs]);

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

  const getLogId = useCallback((log: LogRecord) => logIdMap.get(log), [logIdMap]);

  const handleLogClick = useCallback(
    (log: LogRecord) => {
      const id = logIdMap.get(log);
      if (!id) return;
      if (featuredLogId === id) {
        onFeaturedChange({ logId: null });
        return;
      }
      if (featuredTraceId) {
        onFeaturedChange({ logId: id, traceId: log.traceId ?? null, spanId: null });
      } else {
        onFeaturedChange({ logId: id });
      }
    },
    [logIdMap, featuredLogId, featuredTraceId, onFeaturedChange],
  );

  const handlePreviousLog =
    featuredLogIdx > 0
      ? () => {
          const prevLog = logs[featuredLogIdx - 1];
          const id = logIdMap.get(prevLog)!;
          if (featuredTraceId) {
            onFeaturedChange({ logId: id, traceId: prevLog.traceId ?? null, spanId: null });
          } else {
            onFeaturedChange({ logId: id });
          }
        }
      : undefined;

  const handleNextLog =
    featuredLogIdx >= 0 && featuredLogIdx < logs.length - 1
      ? () => {
          const nextLog = logs[featuredLogIdx + 1];
          const id = logIdMap.get(nextLog)!;
          if (featuredTraceId) {
            onFeaturedChange({ logId: id, traceId: nextLog.traceId ?? null, spanId: null });
          } else {
            onFeaturedChange({ logId: id });
          }
        }
      : undefined;

  return {
    logIdMap,
    getLogId,
    featuredLog,
    handleLogClick,
    handlePreviousLog,
    handleNextLog,
  };
}
