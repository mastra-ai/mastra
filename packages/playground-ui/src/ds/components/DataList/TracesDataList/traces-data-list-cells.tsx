import { CornerDownRightIcon, DatabaseIcon, ListTreeIcon, RouteIcon } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { DataListCell, DataListTextCell } from '../data-list-cells';
import { Badge } from '@/ds/components/Badge';
import type { BadgeVariant } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { ProcessorIcon } from '@/ds/icons/ProcessorIcon';
import { ScorersIcon } from '@/ds/icons/ScorersIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
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
      <Icon className={cn('size-4 shrink-0', isRoot ? 'text-muted-foreground' : 'text-placeholder')} aria-hidden />
    </span>
  );
  return (
    <DataListCell className="text-body-sm text-muted-foreground flex min-w-0 items-center gap-2">
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
  return <DataListTextCell font="mono">{input || '-'}</DataListTextCell>;
}

// ---------------------------------------------------------------------------
// TypeCell
// ---------------------------------------------------------------------------

type EntityTypeDisplay = { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> };

// Keys are lowercase `EntityType` enum values (plus legacy `workflow`).
const ENTITY_TYPE_DISPLAY: Record<string, EntityTypeDisplay> = {
  agent: { label: 'Agent', Icon: AgentIcon },
  workflow: { label: 'Workflow', Icon: WorkflowIcon },
  workflow_run: { label: 'Workflow', Icon: WorkflowIcon },
  workflow_step: { label: 'Step', Icon: WorkflowIcon },
  tool: { label: 'Tool', Icon: ToolsIcon },
  scorer: { label: 'Scorer', Icon: ScorersIcon },
  memory: { label: 'Memory', Icon: MemoryIcon },
  input_processor: { label: 'Processor', Icon: ProcessorIcon },
  input_step_processor: { label: 'Processor', Icon: ProcessorIcon },
  output_processor: { label: 'Processor', Icon: ProcessorIcon },
  output_step_processor: { label: 'Processor', Icon: ProcessorIcon },
  tool_result_processor: { label: 'Processor', Icon: ProcessorIcon },
  rag_ingestion: { label: 'RAG', Icon: DatabaseIcon },
  trajectory: { label: 'Trajectory', Icon: RouteIcon },
};

export interface TracesDataListTypeCellProps {
  entityType?: string | null;
}

export function TracesDataListTypeCell({ entityType }: TracesDataListTypeCellProps) {
  const display = entityType ? ENTITY_TYPE_DISPLAY[entityType.toLowerCase()] : undefined;

  return (
    <DataListCell className="flex min-w-0 items-center gap-2">
      {display ? (
        <>
          <display.Icon className="text-placeholder size-3.5 shrink-0" aria-hidden />
          <span className="text-body-sm min-w-0 truncate">{display.label}</span>
        </>
      ) : (
        '-'
      )}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// StatusCell
// ---------------------------------------------------------------------------

const UNSET_STATUS_CONFIG: { label: string; variant: BadgeVariant } = { label: '-', variant: 'neutral' };

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  completed: { label: 'OK', variant: 'green' },
  ok: { label: 'OK', variant: 'green' },
  success: { label: 'OK', variant: 'green' },
  error: { label: 'ERR', variant: 'red' },
  running: { label: 'RUN', variant: 'neutral' },
  unset: UNSET_STATUS_CONFIG,
};

export interface TracesDataListStatusCellProps {
  status?: string | null;
}

export function TracesDataListStatusCell({ status }: TracesDataListStatusCellProps) {
  const key = (status ?? 'unset').toLowerCase();
  const config = STATUS_CONFIG[key] ?? UNSET_STATUS_CONFIG;

  return (
    <DataListCell>
      <Badge size="xs" variant={config.variant}>
        {config.label}
      </Badge>
    </DataListCell>
  );
}
