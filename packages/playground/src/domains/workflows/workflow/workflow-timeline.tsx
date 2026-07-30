import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog } from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useAutoscroll } from '@mastra/playground-ui/hooks/use-autoscroll';
import { CheckIcon } from '@mastra/playground-ui/icons/CheckIcon';
import { CrossIcon } from '@mastra/playground-ui/icons/CrossIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  ChevronDown,
  CirclePause,
  HourglassIcon,
  Loader2,
  SquareArrowOutUpRight,
  SquareArrowRight,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import type { Step } from '../context/use-current-run';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { getNodeIndicators } from './components/workflow-card-badge-utils';
import { WorkflowCardBadges } from './components/workflow-card-badges';
import { WorkflowJsonDialogContent } from './workflow-json-dialog';
import type { TimelineRow } from './workflow-timeline-utils';
import { buildTimeline, formatTimelineDuration } from './workflow-timeline-utils';

const StepStatusIcon = ({ status }: { status: Step['status'] }) => (
  <Icon>
    {status === 'success' && <CheckIcon className="text-accent1" />}
    {status === 'failed' && <CrossIcon className="text-accent2" />}
    {status === 'suspended' && <CirclePause className="text-accent3" />}
    {status === 'waiting' && <HourglassIcon className="text-accent5" />}
    {status === 'skipped' && <HourglassIcon className="text-icon3" />}
    {status === 'running' && <Loader2 className="text-accent6 animate-spin" />}
  </Icon>
);

const BAR_TINT: Record<Step['status'], string> = {
  success: 'bg-accent1',
  failed: 'bg-accent2',
  suspended: 'bg-accent3',
  waiting: 'bg-accent5',
  skipped: 'bg-border1',
  running: 'bg-accent6',
};

function titleCase(stepId: string): string {
  return stepId
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type TimelineJsonDialogState = {
  type: 'input' | 'output';
  stepId: string;
  data: Record<string, unknown>;
} | null;

const toDialogData = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
};

const getTimelineIndicators = (step: Step) => {
  const stepWithMetadata = step as Step & {
    duration?: number;
    date?: Date;
    isForEach?: boolean;
    mapConfig?: string;
    canSuspend?: boolean;
    isParallel?: boolean;
    stepGraph?: unknown;
  };

  return getNodeIndicators({
    duration: stepWithMetadata.duration,
    date: stepWithMetadata.date,
    isForEach: stepWithMetadata.isForEach,
    mapConfig: stepWithMetadata.mapConfig,
    canSuspend: stepWithMetadata.canSuspend,
    isParallel: stepWithMetadata.isParallel,
    stepGraph: stepWithMetadata.stepGraph,
  });
};

interface WorkflowTimelineRowProps {
  row: TimelineRow;
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  onSelectStep: (stepId: string) => void;
  onHoverStep: (stepId: string | null) => void;
  onOpenInput: (row: TimelineRow) => void;
  onOpenOutput: (row: TimelineRow) => void;
}

const WorkflowTimelineRow = ({
  row,
  index,
  isSelected,
  isHovered,
  onSelectStep,
  onHoverStep,
  onOpenInput,
  onOpenOutput,
}: WorkflowTimelineRowProps) => {
  const indicators = getTimelineIndicators(row.step);
  const isInProgress = row.status === 'running';
  const canSelect = !row.isNestedEntry;

  return (
    <div
      key={`timeline-item-${row.stepId}-${index}`}
      role="button"
      tabIndex={0}
      data-testid="workflow-timeline-row"
      data-workflow-step-key={row.stepId}
      data-workflow-step-active={isSelected ? 'true' : undefined}
      data-workflow-step-hovered={isHovered ? 'true' : undefined}
      data-workflow-step-nested={row.isNestedEntry ? 'true' : undefined}
      aria-pressed={isSelected}
      aria-disabled={!canSelect}
      onMouseEnter={() => {
        if (canSelect) {
          onHoverStep(row.stepId);
        }
      }}
      onMouseLeave={() => {
        if (canSelect) {
          onHoverStep(null);
        }
      }}
      onClick={() => {
        if (canSelect) {
          onSelectStep(row.stepId);
        }
      }}
      onKeyDown={event => {
        if (!canSelect || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }

        event.preventDefault();
        onSelectStep(row.stepId);
      }}
      className={cn(
        'grid grid-cols-[auto_auto_auto_minmax(0,10rem)_minmax(0,1fr)_auto_5rem] items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1',
        canSelect && 'cursor-pointer',
        canSelect && 'hover:bg-surface4',
        canSelect && isHovered && !isSelected && 'border-neutral6 bg-surface4',
        canSelect && isSelected && 'border-accent1',
        row.isNestedEntry && 'cursor-default opacity-55',
      )}
    >
      <div className="flex justify-center">
        <StepStatusIcon status={row.status} />
      </div>
      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tooltip="View step input"
          disabled={isInProgress}
          className="text-neutral3 hover:text-neutral6 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={event => {
            event.stopPropagation();
            if (!isInProgress) {
              onOpenInput(row);
            }
          }}
        >
          <SquareArrowRight />
        </Button>
      </div>
      <div className="flex overflow-hidden">
        <WorkflowCardBadges indicators={indicators} className="shrink-0" />
      </div>
      <Txt
        as="span"
        variant="ui-sm"
        className="text-neutral6 block max-w-full min-w-0 justify-self-stretch overflow-hidden text-left text-ellipsis whitespace-nowrap"
      >
        {titleCase(row.stepId)}
      </Txt>
      <div className="bg-surface4 relative h-2 min-w-0 rounded">
        <div
          data-testid="workflow-timeline-bar"
          data-offset={String(row.offsetPct)}
          data-width={String(row.widthPct)}
          className={`absolute top-0 h-full rounded ${BAR_TINT[row.status]}`}
          style={{ left: `${row.offsetPct}%`, width: `${row.widthPct}%` }}
        />
      </div>
      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tooltip="View step output"
          disabled={isInProgress}
          className="text-neutral3 hover:text-neutral6 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={event => {
            event.stopPropagation();
            if (!isInProgress) {
              onOpenOutput(row);
            }
          }}
        >
          <SquareArrowOutUpRight />
        </Button>
      </div>
      <Txt as="span" variant="ui-sm" className="text-neutral3 w-20 justify-self-end text-right tabular-nums">
        {formatTimelineDuration(row.durationMs)}
      </Txt>
    </div>
  );
};

export function WorkflowTimeline() {
  const { steps } = useCurrentRun();
  const { selectedStepId, hoverStepId, setSelectedStepId, setHoverStepId } = useWorkflowSelectedStep();
  const [now, setNow] = useState(() => Date.now());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [jsonDialog, setJsonDialog] = useState<TimelineJsonDialogState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useAutoscroll(scrollRef, { enabled: !isCollapsed });

  const rows = buildTimeline(steps, now);
  const hasRunning = rows.some(row => row.isRunning);

  useEffect(() => {
    if (!hasRunning) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [hasRunning]);

  useEffect(() => {
    if (isCollapsed || rows.length === 0) {
      return;
    }

    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [isCollapsed, rows.length]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      <div
        data-testid="workflow-timeline"
        className="pointer-events-none absolute right-0 bottom-0 z-20 px-2 pb-2"
        style={
          {
            left: 'var(--workflow-left-panel-width, 0px)',
          } as CSSProperties
        }
      >
        <div className="rounded-studio-panel border-border1/50 bg-surface3 pointer-events-auto flex max-h-64 w-full min-w-0 flex-col gap-3 overflow-hidden border p-4 shadow-lg">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <Txt as="p" variant="ui-md" className="text-neutral3">
              Timeline
            </Txt>
            <button
              type="button"
              aria-label={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
              aria-expanded={!isCollapsed}
              onClick={() => setIsCollapsed(collapsed => !collapsed)}
              className="text-neutral3 hover:bg-surface4 hover:text-neutral6 rounded-md p-1 transition-colors"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', isCollapsed && '-rotate-90')} />
            </button>
          </div>
          {!isCollapsed && (
            <div
              ref={scrollRef}
              data-testid="workflow-timeline-list"
              className="flex min-h-0 flex-col gap-2 overflow-y-auto"
            >
              {rows.map((row, index) => (
                <WorkflowTimelineRow
                  key={`timeline-item-${row.stepId}-${index}`}
                  row={row}
                  index={index}
                  isSelected={selectedStepId === row.stepId}
                  isHovered={hoverStepId === row.stepId}
                  onSelectStep={setSelectedStepId}
                  onHoverStep={setHoverStepId}
                  onOpenInput={timelineRow =>
                    setJsonDialog({
                      type: 'input',
                      stepId: timelineRow.stepId,
                      data: toDialogData(timelineRow.step.input),
                    })
                  }
                  onOpenOutput={timelineRow =>
                    setJsonDialog({
                      type: 'output',
                      stepId: timelineRow.stepId,
                      data: toDialogData(timelineRow.step.output),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(jsonDialog)} onOpenChange={open => !open && setJsonDialog(null)}>
        {jsonDialog && (
          <WorkflowJsonDialogContent
            data={jsonDialog.data}
            title={`${titleCase(jsonDialog.stepId)} ${jsonDialog.type === 'input' ? 'input' : 'output'}`}
          />
        )}
      </Dialog>
    </>
  );
}
