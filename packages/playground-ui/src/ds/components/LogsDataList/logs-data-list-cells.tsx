import { format, isToday } from 'date-fns';
import { Code } from 'lucide-react';
import { DataListCell } from '../DataList/data-list-cells';
import type { LogLevel } from '@/domains/logs/types';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

const LEVEL_CONFIG: Record<LogLevel, { label: string; color: string }> = {
  debug: { label: 'DEBUG', color: '#71717a' },
  info: { label: 'INFO', color: '#60a5fa' },
  warn: { label: 'WARN', color: '#facc15' },
  error: { label: 'ERROR', color: '#f87171' },
  fatal: { label: 'FATAL', color: '#dc2626' },
};

// ---------------------------------------------------------------------------
// LevelCell
// ---------------------------------------------------------------------------

export interface LogsDataListLevelCellProps {
  level: LogLevel;
}

export function LogsDataListLevelCell({ level }: LogsDataListLevelCellProps) {
  const config = LEVEL_CONFIG[level];

  return (
    <DataListCell height="compact">
      <span className="uppercase text-ui-sm font-semibold" style={{ color: config.color }}>
        {config.label}
      </span>
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// DateCell
// ---------------------------------------------------------------------------

export interface LogsDataListDateCellProps {
  timestamp: Date | string;
}

export function LogsDataListDateCell({ timestamp }: LogsDataListDateCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell height="compact" className="text-ui-smd text-neutral2">
      {isToday(date) ? 'Today' : format(date, 'MMM dd')}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// TimeCell
// ---------------------------------------------------------------------------

export interface LogsDataListTimeCellProps {
  timestamp: Date | string;
}

export function LogsDataListTimeCell({ timestamp }: LogsDataListTimeCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell height="compact" className="text-ui-smd font-mono text-neutral3 flex">
      {format(date, 'HH:mm:ss')}
      <span className="text-neutral2">.{String(date.getMilliseconds()).padStart(3, '0')}</span>
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// EntityCell
// ---------------------------------------------------------------------------

function EntityTypeIcon({ entityType, className }: { entityType: string; className?: string }) {
  const iconClass = cn('size-3.5 shrink-0 text-neutral2', className);
  switch (entityType) {
    case 'AGENT':
      return <AgentIcon className={iconClass} aria-hidden />;
    case 'WORKFLOW':
      return <WorkflowIcon className={iconClass} aria-hidden />;
    case 'TOOL':
      return <ToolsIcon className={iconClass} aria-hidden />;
    default:
      return <Code className={iconClass} aria-hidden strokeWidth={2} />;
  }
}

export interface LogsDataListEntityCellProps {
  entityType?: string | null;
  entityName?: string | null;
}

export function LogsDataListEntityCell({ entityType, entityName }: LogsDataListEntityCellProps) {
  const type = entityType ?? '';

  return (
    <DataListCell height="compact" className="flex min-w-0 items-center gap-2">
      <EntityTypeIcon entityType={type} />
      <span className="min-w-0 text-ui-smd truncate">{entityName}</span>
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
    <DataListCell height="compact" className="text-neutral4 text-ui-smd min-w-0 truncate font-mono">
      {message}
    </DataListCell>
  );
}
