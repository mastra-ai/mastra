import { DataListCell, DataListTextCell } from '../DataList/data-list-cells';
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { cn } from '@/lib/utils';

const LEVEL_CONFIG: Record<LogLevel, { label: string; color: string }> = {
  debug: { label: 'DEBUG', color: 'var(--muted-foreground)' },
  info: { label: 'INFO', color: 'var(--notice-info)' },
  warn: { label: 'WARN', color: 'var(--notice-warning)' },
  error: { label: 'ERROR', color: 'var(--notice-destructive)' },
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
      {entityName ? <span className="text-body-sm min-w-0 truncate">{entityName}</span> : '-'}
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
    <DataListCell className="text-body-sm text-muted-foreground min-w-0 truncate font-mono">{message}</DataListCell>
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
