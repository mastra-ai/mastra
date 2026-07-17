import { EntityType } from '@mastra/core/observability';
import { DataListCell, DataListMonoCell } from '../DataList/data-list-cells';
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { cn } from '@/lib/utils';

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
      <span className="text-ui-sm font-semibold uppercase" style={{ color: config.color }}>
        {config.label}
      </span>
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// EntityCell
// ---------------------------------------------------------------------------

function EntityTypeIcon({ entityType, className }: { entityType: string; className?: string }) {
  const iconClass = cn('size-3.5 shrink-0 text-neutral2', className);
  const normalizedEntityType = entityType.toLowerCase();

  switch (normalizedEntityType) {
    case EntityType.AGENT:
      return <AgentIcon className={iconClass} aria-hidden />;
    case 'workflow':
    case EntityType.WORKFLOW_RUN:
      return <WorkflowIcon className={iconClass} aria-hidden />;
    case EntityType.TOOL:
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
    <DataListCell height="compact" className="flex min-w-0 items-center gap-2">
      <EntityTypeIcon entityType={type} />
      {entityName ? <span className="min-w-0 truncate text-ui-smd">{entityName}</span> : '-'}
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
    <DataListCell height="compact" className="min-w-0 truncate font-mono text-ui-smd text-neutral4">
      {message}
    </DataListCell>
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
    return <DataListCell height="compact">{null}</DataListCell>;
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

  return <DataListMonoCell>{summary}</DataListMonoCell>;
}
