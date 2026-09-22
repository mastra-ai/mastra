import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CircleSlash,
  CircleX,
  CornerDownRight,
  CircleHelp,
  Loader2,
  Pause,
  SkipForward,
  Timer,
} from 'lucide-react';
import type { Step } from '../context/use-current-run';
import type { TimelineRow } from './workflow-timeline-utils';

const statusPresentation = {
  success: { label: 'Completed', icon: Check, color: 'text-positive1', bar: 'bg-neutral3/60' },
  failed: { label: 'Failed', icon: CircleX, color: 'text-negative1', bar: 'bg-negative1/60' },
  suspended: { label: 'Needs input', icon: Pause, color: 'text-accent3', bar: 'bg-accent3/60' },
  waiting: { label: 'Waiting', icon: Timer, color: 'text-muted-foreground', bar: 'bg-neutral3/40' },
  paused: { label: 'Paused', icon: Pause, color: 'text-muted-foreground', bar: 'bg-neutral3/40' },
  skipped: { label: 'Skipped', icon: SkipForward, color: 'text-muted-foreground', bar: 'bg-neutral3/25' },
  running: { label: 'Running', icon: Loader2, color: 'text-accent6', bar: 'bg-accent6/60' },
  canceled: { label: 'Canceled', icon: CircleSlash, color: 'text-muted-foreground', bar: 'bg-neutral3/40' },
} satisfies Record<Step['status'], { label: string; icon: typeof Check; color: string; bar: string }>;

const unknownStatus = {
  label: 'Status unavailable',
  icon: CircleHelp,
  color: 'text-muted-foreground',
  bar: 'bg-neutral3/25',
};

export interface WorkflowTimelineRowProps {
  row: TimelineRow;
  isSelected: boolean;
  isHovered: boolean;
  onSelectStep: (stepId: string) => void;
  onHoverStep: (stepId: string | null) => void;
  onOpenInput: (row: TimelineRow, trigger: HTMLButtonElement) => void;
  onOpenOutput: (row: TimelineRow, trigger: HTMLButtonElement) => void;
}

export function WorkflowTimelineRow({
  row,
  isSelected,
  isHovered,
  onSelectStep,
  onHoverStep,
  onOpenInput,
  onOpenOutput,
}: WorkflowTimelineRowProps) {
  const status = Object.hasOwn(statusPresentation, row.status) ? statusPresentation[row.status] : unknownStatus;
  const StatusIcon = status.icon;
  const parentPath = row.stepId.slice(0, row.stepId.lastIndexOf('.'));
  const label = row.isNestedEntry ? row.stepId.slice(row.stepId.lastIndexOf('.') + 1) : row.stepId;

  return (
    <div
      data-testid="workflow-timeline-row"
      data-workflow-step-key={row.stepId}
      onMouseEnter={() => !row.isNestedEntry && onHoverStep(row.stepId)}
      onMouseLeave={() => !row.isNestedEntry && onHoverStep(null)}
      className={cn(
        'grid grid-cols-[minmax(130px,1fr)_minmax(64px,1fr)_56px_64px] items-center gap-3 rounded-md px-2 py-1',
        '@max-[540px]/workflow-timeline:grid-cols-[minmax(0,1fr)_48px_64px] @max-[540px]/workflow-timeline:gap-x-1.5 @max-[540px]/workflow-timeline:gap-y-1 @max-[540px]/workflow-timeline:py-2',
        (isSelected || isHovered) && 'bg-fill-subtle',
      )}
    >
      <button
        type="button"
        className="text-meta text-foreground focus-visible:outline-neutral3 flex min-h-9 min-w-0 cursor-pointer items-center gap-2.5 text-left focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 aria-disabled:cursor-default"
        aria-disabled={row.isNestedEntry}
        aria-pressed={isSelected}
        onClick={() => {
          if (row.isNestedEntry) return;
          onSelectStep(row.stepId);
        }}
        title={row.stepId}
      >
        <span
          aria-label={status.label}
          className={cn(
            'border-border bg-background grid size-6 flex-none place-items-center rounded-md border',
            status.color,
          )}
        >
          <StatusIcon aria-hidden className={cn('size-3.5', row.status === 'running' && 'motion-safe:animate-spin')} />
        </span>
        <span className="min-w-0">
          <span className="block truncate">{label}</span>
          {row.isNestedEntry && (
            <span className="text-muted-foreground text-meta flex min-w-0 items-center gap-1">
              <CornerDownRight aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{parentPath}</span>
            </span>
          )}
        </span>
      </button>
      <div
        className="bg-muted relative h-5 min-w-0 overflow-hidden rounded-sm @max-[540px]/workflow-timeline:col-span-full @max-[540px]/workflow-timeline:row-start-2 @max-[540px]/workflow-timeline:ml-[34px]"
        aria-hidden
      >
        {row.timing && (
          <div
            data-testid="workflow-timeline-bar"
            data-offset={row.timing.offsetPct}
            data-width={row.timing.widthPct}
            className={cn('absolute top-0 h-full min-w-0.5 rounded-sm', status.bar)}
            style={{ left: `${row.timing.offsetPct}%`, width: `${row.timing.widthPct}%` }}
          />
        )}
      </div>
      <span
        className="text-muted-foreground text-meta text-right whitespace-nowrap tabular-nums"
        title={row.timing && row.spansSuspension ? 'Includes time spent suspended waiting for input' : undefined}
      >
        {row.timing ? formatDuration(row.timing.durationMs) : <span aria-label="Timing unavailable">—</span>}
      </span>
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tooltip="View step input"
          disabled={row.step.input === undefined}
          onClick={event => onOpenInput(row, event.currentTarget)}
        >
          <ArrowDownToLine />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tooltip="View step output"
          disabled={row.step.output === undefined}
          onClick={event => onOpenOutput(row, event.currentTarget)}
        >
          <ArrowUpFromLine />
        </Button>
      </div>
    </div>
  );
}
