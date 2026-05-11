import { LogsDataList } from '@mastra/playground-ui';
import type { ColumnConfig, LogsListColumnDef, LogRecord } from '@mastra/playground-ui';

/** Discoverable sources on a log record. Keep small — only well-known free-form JSON fields. */
export const LOG_CUSTOM_COLUMN_SOURCES = ['metadata', 'data'] as const;
export type LogCustomColumnSource = (typeof LOG_CUSTOM_COLUMN_SOURCES)[number];

export function formatLogCellValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Walks `obj` by direct key first, then by dotted path. Same shape as the traces resolver. */
function getByPath(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function resolveLogCustomColumnValue(log: LogRecord, source: string, key: string): unknown {
  if (source === 'metadata') return getByPath(log.metadata ?? null, key);
  if (source === 'data') return getByPath(log.data ?? null, key);
  return undefined;
}

export const LOG_COLUMN_DEFS: LogsListColumnDef[] = [
  {
    name: 'date',
    label: 'Date',
    gridSize: '6rem',
    renderCell: log => <LogsDataList.DateCell timestamp={log.timestamp} />,
  },
  {
    name: 'time',
    label: 'Time',
    gridSize: '9rem',
    renderCell: log => <LogsDataList.TimeCell timestamp={log.timestamp} />,
  },
  {
    name: 'level',
    label: 'Level',
    gridSize: '5rem',
    renderCell: log => <LogsDataList.LevelCell level={log.level} />,
  },
  {
    name: 'entityId',
    label: 'Entity',
    gridSize: '10rem',
    renderCell: log => <LogsDataList.EntityCell entityType={log.entityType} entityName={log.entityName} />,
  },
  {
    name: 'message',
    label: 'Message',
    gridSize: 'minmax(8rem,1fr)',
    renderCell: log => <LogsDataList.MessageCell message={log.message} />,
  },
  {
    name: 'data',
    label: 'Data',
    gridSize: 'minmax(8rem,1fr)',
    renderCell: log => <LogsDataList.DataCell data={log.data} />,
  },
];

export const LOGS_COLUMN_CONFIGS: ColumnConfig[] = LOG_COLUMN_DEFS.map(({ name, label }) => ({ name, label }));
export const LOGS_COLUMN_NAMES: string[] = LOG_COLUMN_DEFS.map(c => c.name);

/**
 * Optional built-in columns mirroring filterable log fields. Toggled on from
 * the picker's "Filter fields"-style section; not shown by default.
 */
function textColumn(name: string, label: string): LogsListColumnDef {
  return {
    name,
    label,
    gridSize: 'minmax(5rem,1fr)',
    renderCell: log => (
      <LogsDataList.MessageCell message={formatLogCellValue((log as unknown as Record<string, unknown>)[name]) ?? ''} />
    ),
  };
}

export const LOG_OPTIONAL_COLUMN_DEFS: LogsListColumnDef[] = [
  textColumn('rootEntityType', 'Primitive Type'),
  textColumn('entityName', 'Primitive Name'),
  textColumn('serviceName', 'Service Name'),
  textColumn('environment', 'Environment'),
  textColumn('runId', 'Run ID'),
  textColumn('sessionId', 'Session ID'),
  textColumn('requestId', 'Request ID'),
  textColumn('resourceId', 'Resource ID'),
  textColumn('userId', 'User ID'),
  textColumn('organizationId', 'Organization ID'),
  textColumn('experimentId', 'Experiment ID'),
  textColumn('traceId', 'Trace ID'),
  textColumn('spanId', 'Span ID'),
  {
    name: 'tags',
    label: 'Tags',
    gridSize: 'minmax(5rem,1fr)',
    renderCell: log => {
      const tags = (log as unknown as Record<string, unknown>).tags;
      const formatted = Array.isArray(tags) ? tags.join(', ') : formatLogCellValue(tags);
      return <LogsDataList.MessageCell message={formatted ?? ''} />;
    },
  },
];

export const OPTIONAL_LOGS_COLUMN_CONFIGS: ColumnConfig[] = LOG_OPTIONAL_COLUMN_DEFS.map(({ name, label }) => ({
  name,
  label,
}));

export const ALL_BUILT_IN_LOG_COLUMN_DEFS: LogsListColumnDef[] = [...LOG_COLUMN_DEFS, ...LOG_OPTIONAL_COLUMN_DEFS];
