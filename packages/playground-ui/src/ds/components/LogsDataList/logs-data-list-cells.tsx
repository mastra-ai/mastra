import { Badge } from '../Badge';
import type { BadgeVariant } from '../Badge';
import { DataListCell, DataListTextCell } from '../DataList/data-list-cells';
import { logLevelDotClass, logLevelTextClass } from './log-level-styles';
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
  fields?: Record<string, unknown>;
  wrap?: boolean;
  collapse?: boolean;
}

const COLLAPSED_LINE_COUNT = 3;

function formatFieldValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function parseJsonObject(message: string): Record<string, unknown> | undefined {
  const trimmed = message.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : undefined;
  } catch {
    return undefined;
  }
}

function LogFields({ entries }: { entries: Array<[string, unknown]> }) {
  return entries.map(([key, value]) => (
    <span key={key} className="ml-3 first:ml-0">
      <span className="text-muted-foreground">{key}:</span> {formatFieldValue(value)}
    </span>
  ));
}

function LogMessage({ message, collapse }: { message: string; collapse: boolean }) {
  const json = parseJsonObject(message);
  if (json) return <LogFields entries={Object.entries(json)} />;

  const lines = message.split('\n');
  const hidden = lines.length - COLLAPSED_LINE_COUNT;
  if (!collapse || hidden < 2) return <>{message}</>;

  return (
    <>
      {lines.slice(0, COLLAPSED_LINE_COUNT).join('\n')}
      {'\n'}
      <span className="text-muted-foreground">
        +{hidden} more {hidden === 1 ? 'line' : 'lines'}
      </span>
    </>
  );
}

export function LogsDataListLineCell({
  timestamp,
  level,
  message,
  fields,
  wrap = true,
  collapse = true,
}: LogsDataListLineCellProps) {
  const fieldEntries = fields ? Object.entries(fields) : [];

  return (
    <>
      <span aria-hidden className={cn('absolute inset-y-1 left-1 w-0.5 rounded-full', logLevelDotClass[level])} />
      <DataListCell className="content-start font-mono tabular-nums">
        <time dateTime={toDate(timestamp)?.toISOString()}>
          {formatLogLineTimestamp(timestamp) ?? String(timestamp)}
        </time>
      </DataListCell>
      <DataListCell className={cn('content-start font-mono uppercase', logLevelTextClass[level])}>{level}</DataListCell>
      <DataListCell
        className={cn(
          'block font-mono text-foreground @max-md:col-span-full',
          wrap ? 'wrap-anywhere whitespace-pre-wrap' : 'overflow-visible whitespace-pre',
        )}
      >
        <LogMessage message={message} collapse={collapse} />
        {fieldEntries.length > 0 && (
          <span className="ml-3">
            <LogFields entries={fieldEntries} />
          </span>
        )}
      </DataListCell>
    </>
  );
}
