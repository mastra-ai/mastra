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
    <DataListCell height="compact" className="text-neutral4 text-ui-smd min-w-0 flex items-center gap-2">
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
      {entityName ? <span className="min-w-0 text-ui-smd truncate">{entityName}</span> : '-'}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// DurationCell
// ---------------------------------------------------------------------------

/** Formats a duration in milliseconds to a compact human-readable string.
 *  Examples: "0ms", "123ms", "1.23s", "2m 5s", "1h 12m" */
function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export interface TracesDataListDurationCellProps {
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
}

export function TracesDataListDurationCell({ startedAt, endedAt }: TracesDataListDurationCellProps) {
  if (!startedAt || !endedAt) {
    return (
      <DataListCell height="compact" className="text-ui-smd font-mono text-neutral2">
        -
      </DataListCell>
    );
  }
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const end = endedAt instanceof Date ? endedAt : new Date(endedAt);
  const durationMs = end.getTime() - start.getTime();

  return (
    <DataListCell height="compact" className="text-ui-smd font-mono text-neutral3">
      {formatDurationMs(Math.max(0, durationMs))}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// StatusCell
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: 'OK', color: Colors.accent2 },
  ok: { label: 'OK', color: Colors.accent2 },
  error: { label: 'ERR', color: Colors.error },
  unset: { label: '-', color: Colors.neutral4 },
};

export interface TracesDataListStatusCellProps {
  status?: string | null;
}

export function TracesDataListStatusCell({ status }: TracesDataListStatusCellProps) {
  const key = (status ?? 'unset').toLowerCase();
  const config = STATUS_CONFIG[key] ?? STATUS_CONFIG['unset'];

  return (
    <DataListCell height="compact">
      <span className="uppercase text-ui-sm font-semibold" style={{ color: config.color }}>
        {config.label}
      </span>
    </DataListCell>
  );
}
