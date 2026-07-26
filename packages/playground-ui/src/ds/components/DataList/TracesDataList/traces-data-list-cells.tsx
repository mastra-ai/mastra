import { EntityType } from '@mastra/core/observability';
import { CornerDownRightIcon, ListTreeIcon } from 'lucide-react';
import { DataListCell, DataListMonoCell } from '../data-list-cells';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { Colors } from '@/ds/tokens/colors';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// NameCell
// ---------------------------------------------------------------------------

export interface TracesDataListNameCellProps {
  name?: string | null;
  /** `null`/missing → root span (Trace). Set → nested span (Subtrace). Drives the leading level icon. */
  parentSpanId?: string | null;
  /** When true, the leading level icon is wrapped in a Trace/Subtrace tooltip. Off by default —
   *  only meaningful in branches mode, where rows mix root traces and subtraces. */
  showLevelTooltip?: boolean;
}

export function TracesDataListNameCell({ name, parentSpanId, showLevelTooltip }: TracesDataListNameCellProps) {
  const isRoot = parentSpanId == null;
  const Icon = isRoot ? ListTreeIcon : CornerDownRightIcon;
  const label = isRoot ? 'Trace' : 'Subtrace';
  const icon = (
    <span aria-label={label} className="inline-flex shrink-0">
      <Icon className={cn('size-4 shrink-0', isRoot ? 'text-neutral3' : 'text-neutral2')} aria-hidden />
    </span>
  );
  return (
    <DataListCell height="compact" className="text-ui-smd text-neutral4 flex min-w-0 items-center gap-2">
      {showLevelTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{icon}</TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        icon
      )}
      <span className="min-w-0 truncate">{name || '-'}</span>
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// InputCell
// ---------------------------------------------------------------------------

export interface TracesDataListInputCellProps {
  input?: string | null;
}

export function TracesDataListInputCell({ input }: TracesDataListInputCellProps) {
  return <DataListMonoCell>{input || '-'}</DataListMonoCell>;
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
    default:
      return null;
  }
}

export interface TracesDataListEntityCellProps {
  entityType?: string | null;
  entityName?: string | null;
}

export function TracesDataListEntityCell({ entityType, entityName }: TracesDataListEntityCellProps) {
  const type = entityType ?? '';

  return (
    <DataListCell height="compact" className="flex min-w-0 items-center gap-2">
      <EntityTypeIcon entityType={type} />
      {entityName ? <span className="text-ui-smd min-w-0 truncate">{entityName}</span> : '-'}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// StatusCell
// ---------------------------------------------------------------------------

const UNSET_STATUS_CONFIG = { label: '-', color: Colors.neutral4 };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: 'OK', color: Colors.accent2 },
  ok: { label: 'OK', color: Colors.accent2 },
  error: { label: 'ERR', color: Colors.error },
  unset: UNSET_STATUS_CONFIG,
};

export interface TracesDataListStatusCellProps {
  status?: string | null;
}

export function TracesDataListStatusCell({ status }: TracesDataListStatusCellProps) {
  const key = (status ?? 'unset').toLowerCase();
  const config = STATUS_CONFIG[key] ?? UNSET_STATUS_CONFIG;

  return (
    <DataListCell height="compact">
      <span className="text-ui-sm font-semibold uppercase" style={{ color: config.color }}>
        {config.label}
      </span>
    </DataListCell>
  );
}
