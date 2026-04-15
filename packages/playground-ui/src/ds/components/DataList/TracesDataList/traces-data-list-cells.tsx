import { format, isToday } from 'date-fns';
import { DataListCell } from '../data-list-cells';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { Colors } from '@/ds/tokens/colors';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function getShortId(id: string | undefined): string {
  if (!id) return '';
  return id.length > 8 ? id.slice(0, 8) : id;
}

// ---------------------------------------------------------------------------
// IdCell
// ---------------------------------------------------------------------------

export interface TracesDataListIdCellProps {
  traceId: string;
}

export function TracesDataListIdCell({ traceId }: TracesDataListIdCellProps) {
  return (
    <DataListCell height="compact" className="text-ui-smd font-mono text-neutral3">
      {getShortId(traceId)}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// DateCell
// ---------------------------------------------------------------------------

export interface TracesDataListDateCellProps {
  timestamp: Date | string;
}

export function TracesDataListDateCell({ timestamp }: TracesDataListDateCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell height="compact" className="text-ui-smd text-neutral2">
      {date ? (isToday(date) ? 'Today' : format(date, 'MMM dd')) : '-'}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// TimeCell
// ---------------------------------------------------------------------------

export interface TracesDataListTimeCellProps {
  timestamp: Date | string;
}

export function TracesDataListTimeCell({ timestamp }: TracesDataListTimeCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell height="compact" className="text-ui-smd font-mono text-neutral3 flex">
      {date ? (
        <>
          {format(date, 'HH:mm:ss')}
          <span className="text-neutral2">.{String(date.getMilliseconds()).padStart(3, '0')}</span>
        </>
      ) : (
        '-'
      )}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// NameCell
// ---------------------------------------------------------------------------

export interface TracesDataListNameCellProps {
  name?: string | null;
}

export function TracesDataListNameCell({ name }: TracesDataListNameCellProps) {
  return (
    <DataListCell height="compact" className="text-neutral4 text-ui-smd min-w-0 truncate">
      {name || '-'}
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
  return (
    <DataListCell height="compact" className="min-w-0">
      <span className="block text-neutral3 text-ui-smd font-mono truncate">{input || '-'}</span>
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
    case 'WORKFLOW_RUN':
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
