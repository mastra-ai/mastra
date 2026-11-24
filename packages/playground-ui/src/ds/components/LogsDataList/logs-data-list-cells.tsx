import { Badge } from '../Badge';
import type { BadgeVariant } from '../Badge';
import { DataListCell, DataListTextCell } from '../DataList/data-list-cells';
import { logLevelTextClass } from './log-level-styles';
import type { LogLevel } from './log-level-styles';
import { Txt } from '@/ds/components/Txt';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { cn } from '@/lib/utils';
import { formatLogLineTimestamp, toDate } from '@/utils/date-format';

const LEVEL_VARIANT: Record<LogLevel, BadgeVariant> = {
  debug: 'neutral',
  info: 'info',
  warn: 'warning',
  error: 'destructive',
  fatal: 'destructive',
};

// ---------------------------------------------------------------------------
// LevelCell
// ---------------------------------------------------------------------------

export interface LogsDataListLevelCellProps {
  level: LogLevel;
}

export function LogsDataListLevelCell({ level }: LogsDataListLevelCellProps) {
  return (
    <DataListCell>
      <Badge variant={LEVEL_VARIANT[level]}>{level}</Badge>
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// EntityCell
// ---------------------------------------------------------------------------

function EntityTypeIcon({ entityType, className }: { entityType: string; className?: string }) {
  const iconClass = cn('size-3.5 shrink-0 text-subtle-foreground', className);
  const normalizedEntityType = entityType.toLowerCase();

  switch (normalizedEntityType) {
    case 'agent':
      return <AgentIcon className={iconClass} aria-hidden />;
    case 'workflow':
    case 'workflow_run':
      return <WorkflowIcon className={iconClass} aria-hidden />;
    case 'tool':
      return <ToolsIcon className={iconClass} aria-hidden />;
    default:
      return null;
  }
}

export interface LogsDataListEntityCellProps {
  entityType?: string | null;
  entityName?: string | null;
}

export function LogsDataListEntityCell({ entityType, entityName }: LogsDataListEntityCellProps) {
  const type = entityType ?? '';

  return (
    <DataListCell className="flex min-w-0 items-center gap-2">
      <EntityTypeIcon entityType={type} />
      {entityName ? (
        <Txt as="span" variant="body-sm" className="min-w-0 truncate">
          {entityName}
        </Txt>
      ) : (
        '-'
      )}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// MessageCell
// ---------------------------------------------------------------------------

export interface LogsDataListMessageCellProps {
  message: string;
}

export function LogsDataListMessageCell({ message }: LogsDataListMessageCellProps) {
  return (
    <DataListCell className="min-w-0 truncate font-mono text-body-sm text-muted-foreground">{message}</DataListCell>
  );
}

// ---------------------------------------------------------------------------
// DataCell
// ---------------------------------------------------------------------------

export interface LogsDataListDataCellProps {
  data?: Record<string, unknown> | null;
}

export function LogsDataListDataCell({ data }: LogsDataListDataCellProps) {
  if (!data || Object.keys(data).length === 0) {
    return <DataListCell>{null}</DataListCell>;
  }

  const summary = Object.entries(data)
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}: ${v}`;
      try {
        return `${k}: ${JSON.stringify(v)}`;
      } catch {
        return `${k}: <unserializable>`;
      }
    })
    .join(', ');

  return <DataListTextCell font="mono">{summary}</DataListTextCell>;
}

export interface LogsDataListLineCellProps {
  timestamp: Date | string;
  level: LogLevel;
  message: string;
  fields?: Record<string, unknown> | null;
}

function formatFieldValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function LogsDataListLineCell({ timestamp, level, message, fields }: LogsDataListLineCellProps) {
  const fieldEntries = fields ? Object.entries(fields) : [];

  return (
    <DataListCell className="block py-0.5 font-mono whitespace-normal">
      <span className="flex flex-wrap items-baseline gap-x-4">
        <time dateTime={toDate(timestamp)?.toISOString()} className="shrink-0 tabular-nums">
          {formatLogLineTimestamp(timestamp) ?? String(timestamp)}
        </time>
        <span className={cn('w-12 shrink-0 uppercase', logLevelTextClass[level])}>{level}</span>
        <span className="min-w-0 grow basis-60 wrap-anywhere whitespace-pre-wrap text-foreground">
          {message}
          {fieldEntries.map(([key, value]) => (
            <span key={key} className="ml-3">
              <span className="text-muted-foreground">{key}:</span> {formatFieldValue(value)}
            </span>
          ))}
        </span>
      </span>
    </DataListCell>
  );
}
