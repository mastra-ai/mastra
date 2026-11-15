import { Loader2 } from 'lucide-react';
import type { Step } from '../context/use-current-run';
import { workflowStatusTone, workflowStatusToneBar, workflowStatusToneText } from '../workflow-status-tone';
import type { TimelineRow } from './workflow-timeline-utils';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconArrowCornerDownRight } from '@/ds/icons/central/IconArrowCornerDownRight';
import { IconArrowUpWall } from '@/ds/icons/central/IconArrowUpWall';
import { IconArrowWallDown } from '@/ds/icons/central/IconArrowWallDown';
import { IconCheckmark1 } from '@/ds/icons/central/IconCheckmark1';
import { IconCircleBanSign } from '@/ds/icons/central/IconCircleBanSign';
import { IconCircleX } from '@/ds/icons/central/IconCircleX';
import { IconPause } from '@/ds/icons/central/IconPause';
import { IconQuestionmarkCircle } from '@/ds/icons/central/IconQuestionmarkCircle';
import { IconSkip } from '@/ds/icons/central/IconSkip';
import { IconStopwatch } from '@/ds/icons/central/IconStopwatch';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';
import { formatDuration } from '@/utils/duration';

const statusPresentation = {
  success: { label: 'Completed', icon: IconCheckmark1 },
  failed: { label: 'Failed', icon: IconCircleX },
  suspended: { label: 'Needs input', icon: IconPause },
  waiting: { label: 'Waiting', icon: IconStopwatch },
  paused: { label: 'Paused', icon: IconPause },
  skipped: { label: 'Skipped', icon: IconSkip },
  running: { label: 'Running', icon: Loader2 },
  canceled: { label: 'Canceled', icon: IconCircleBanSign },
} satisfies Record<Step['status'], { label: string; icon: typeof IconCheckmark1 }>;

const unknownStatus = { label: 'Status unavailable', icon: IconQuestionmarkCircle };

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
  const tone = workflowStatusTone(row.status);
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
        aria-disabled={row.isNestedEntry}
        aria-pressed={isSelected}
        onClick={() => {
          if (row.isNestedEntry) return;
          onSelectStep(row.stepId);
        }}
        title={row.stepId}
        className={cn(
          'text-foreground',
          'flex min-h-9 min-w-0 cursor-pointer items-center gap-2.5 text-left focus-visible:rounded-sm aria-disabled:cursor-default',
          focusRing,
        )}
      >
        <span
          aria-label={status.label}
          className={cn(
            'grid size-6 flex-none place-items-center rounded-md border border-border bg-background',
            workflowStatusToneText[tone],
          )}
        >
          <StatusIcon aria-hidden className={cn('size-3.5', row.status === 'running' && 'motion-safe:animate-spin')} />
        </span>
        <span className="min-w-0">
          <Txt as="span" variant="meta" className="block truncate">
            {label}
          </Txt>
          {row.isNestedEntry && (
            <Txt as="span" variant="meta" tone="muted" className="flex min-w-0 items-center gap-1">
              <IconArrowCornerDownRight aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{parentPath}</span>
            </Txt>
          )}
        </span>
      </button>
      <div
        className="relative h-5 min-w-0 overflow-hidden rounded-sm bg-muted @max-[540px]/workflow-timeline:col-span-full @max-[540px]/workflow-timeline:row-start-2 @max-[540px]/workflow-timeline:ml-[34px]"
        aria-hidden
      >
        {row.timing && (
          <div
            data-testid="workflow-timeline-bar"
            data-offset={row.timing.offsetPct}
            data-width={row.timing.widthPct}
            className={cn('absolute top-0 h-full min-w-0.5 rounded-sm', workflowStatusToneBar[tone])}
            style={{ left: `${row.timing.offsetPct}%`, width: `${row.timing.widthPct}%` }}
          />
        )}
      </div>
      <Txt
        as="span"
        variant="meta"
        tone="muted"
        className="text-right whitespace-nowrap"
        title={row.timing && row.spansSuspension ? 'Includes time spent suspended waiting for input' : undefined}
      >
        {row.timing ? (
          <Txt as="span" variant="meta" font="mono">
            {formatDuration(row.timing.durationMs)}
          </Txt>
        ) : (
          <span aria-label="Timing unavailable">—</span>
        )}
      </Txt>
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tooltip="View step input"
          disabled={row.step.input === undefined}
          onClick={event => onOpenInput(row, event.currentTarget)}
        >
          <IconArrowWallDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tooltip="View step output"
          disabled={row.step.output === undefined}
          onClick={event => onOpenOutput(row, event.currentTarget)}
        >
          <IconArrowUpWall />
        </Button>
      </div>
    </div>
  );
}
