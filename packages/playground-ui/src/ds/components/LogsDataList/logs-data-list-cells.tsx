import { DataListCell, DataListTextCell } from '../DataList/data-list-cells';
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { cn } from '@/lib/utils';

const LEVEL_CONFIG: Record<LogLevel, { label: string; color: string }> = {
  debug: { label: 'DEBUG', color: 'var(--muted-foreground)' },
  info: { label: 'INFO', color: 'var(--info-indicator)' },
  warn: { label: 'WARN', color: 'var(--warning-indicator)' },
  error: { label: 'ERROR', color: 'var(--destructive-indicator)' },
  fatal: { label: 'FATAL', color: 'var(--destructive)' },
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
    <DataListCell>
      <span className="text-column uppercase" style={{ color: config.color }}>
        {config.label}
      </span>
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// EntityCell
// ---------------------------------------------------------------------------

function EntityTypeIcon({ entityType, className }: { entityType: string; className?: string }) {
  const iconClass = cn('size-3.5 shrink-0 text-placeholder', className);
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
      {entityName ? <span className="min-w-0 truncate text-body-sm">{entityName}</span> : '-'}
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
