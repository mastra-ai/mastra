import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
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
import { formatTimelineDuration } from './workflow-timeline-utils';

const statusPresentation = {
  success: { label: 'Completed', icon: Check, color: 'text-positive1', bar: 'bg-neutral3/60' },
  failed: { label: 'Failed', icon: CircleX, color: 'text-negative1', bar: 'bg-negative1/60' },
  suspended: { label: 'Needs input', icon: Pause, color: 'text-accent3', bar: 'bg-accent3/60' },
  waiting: { label: 'Waiting', icon: Timer, color: 'text-neutral3', bar: 'bg-neutral3/40' },
  paused: { label: 'Paused', icon: Pause, color: 'text-neutral3', bar: 'bg-neutral3/40' },
  skipped: { label: 'Skipped', icon: SkipForward, color: 'text-neutral3', bar: 'bg-neutral3/25' },
  running: { label: 'Running', icon: Loader2, color: 'text-accent6', bar: 'bg-accent6/60' },
} satisfies Record<Step['status'], { label: string; icon: typeof Check; color: string; bar: string }>;

const unknownStatus = { label: 'Status unavailable', icon: CircleHelp, color: 'text-neutral3', bar: 'bg-neutral3/25' };

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
      data-workflow-step-active={isSelected || undefined}
      data-workflow-step-hovered={isHovered || undefined}
      data-workflow-step-nested={row.isNestedEntry || undefined}
      onMouseEnter={() => !row.isNestedEntry && onHoverStep(row.stepId)}
      onMouseLeave={() => !row.isNestedEntry && onHoverStep(null)}
      className={cn('workflow-timeline-row', (isSelected || isHovered) && 'bg-surface4')}
    >
      <button
        type="button"
        className="workflow-timeline-step"
        disabled={row.isNestedEntry}
        aria-pressed={isSelected}
        onClick={() => onSelectStep(row.stepId)}
        title={row.stepId}
      >
        <span aria-label={status.label} className={cn('workflow-timeline-status', status.color)}>
          <StatusIcon aria-hidden className={cn('size-3.5', row.status === 'running' && 'motion-safe:animate-spin')} />
        </span>
        <span className="min-w-0">
          <span className="block truncate">{label}</span>
          {row.isNestedEntry && (
            <span className="text-neutral3 text-ui-xs flex min-w-0 items-center gap-1">
              <CornerDownRight aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{parentPath}</span>
            </span>
          )}
        </span>
      </button>
      <div className="workflow-timeline-track" aria-hidden>
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
      <span className="text-neutral3 text-ui-xs whitespace-nowrap text-right tabular-nums">
        {row.timing ? formatTimelineDuration(row.timing.durationMs) : <span aria-label="Timing unavailable">—</span>}
      </span>
      <div className="workflow-timeline-data flex items-center">
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
