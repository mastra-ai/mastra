import { CheckIcon, CrossIcon, Icon, Txt, cn, useAutoscroll } from '@mastra/playground-ui';
import { ChevronDown, CirclePause, HourglassIcon, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import type { Step } from '../context/use-current-run';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { buildTimeline } from './workflow-timeline-utils';

const StepStatusIcon = ({ status }: { status: Step['status'] }) => (
  <Icon>
    {status === 'success' && <CheckIcon className="text-accent1" />}
    {status === 'failed' && <CrossIcon className="text-accent2" />}
    {status === 'suspended' && <CirclePause className="text-accent3" />}
    {status === 'waiting' && <HourglassIcon className="text-accent5" />}
    {status === 'running' && <Loader2 className="text-accent6 animate-spin" />}
  </Icon>
);

const BAR_TINT: Record<Step['status'], string> = {
  success: 'bg-accent1',
  failed: 'bg-accent2',
  suspended: 'bg-accent3',
  waiting: 'bg-accent5',
  running: 'bg-accent6',
};

function titleCase(stepId: string): string {
  return stepId
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function WorkflowTimeline() {
  const { steps } = useCurrentRun();
  const { selectedStepId, hoverStepId, setSelectedStepId, setHoverStepId } = useWorkflowSelectedStep();
  const [now, setNow] = useState(() => Date.now());
  const [isCollapsed, setIsCollapsed] = useState(false);
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
    <div
      data-testid="workflow-timeline"
      className="shrink-0 px-2 pb-2"
      style={
        {
          marginLeft: 'var(--workflow-left-panel-width, 0px)',
          width: 'calc(100% - var(--workflow-left-panel-width, 0px))',
        } as CSSProperties
      }
    >
      <div className="flex max-h-64 w-full min-w-0 flex-col gap-3 overflow-hidden rounded-studio-panel border border-border1/50 bg-surface3 p-4">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Txt as="p" variant="ui-md" className="text-neutral3">
            Timeline
          </Txt>
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed(collapsed => !collapsed)}
            className="rounded-md p-1 text-neutral3 transition-colors hover:bg-surface4 hover:text-neutral6"
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
            {rows.map((row, index) => {
              const timeDiff = row.durationMs / 1000;
              const isSelected = selectedStepId === row.stepId;
              const isHovered = hoverStepId === row.stepId;

              return (
                <button
                  key={`timeline-item-${row.stepId}-${index}`}
                  type="button"
                  data-testid="workflow-timeline-row"
                  data-workflow-step-key={row.stepId}
                  data-workflow-step-active={isSelected ? 'true' : undefined}
                  data-workflow-step-hovered={isHovered ? 'true' : undefined}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedStepId(row.stepId)}
                  onMouseEnter={() => setHoverStepId(row.stepId)}
                  onMouseLeave={() => setHoverStepId(null)}
                  className={cn(
                    'grid grid-cols-[10rem_minmax(0,1fr)_5rem] items-center gap-3 rounded-md border border-transparent px-2 py-1 text-left transition-colors',
                    isHovered && 'bg-surface4',
                    isSelected && 'border-accent1',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <StepStatusIcon status={row.status} />
                    <Txt as="span" variant="ui-sm" className="min-w-0 truncate text-neutral6">
                      {titleCase(row.stepId)}
                    </Txt>
                  </div>
                  <div className="relative h-2 min-w-0 rounded bg-surface4">
                    <div
                      data-testid="workflow-timeline-bar"
                      data-offset={String(row.offsetPct)}
                      data-width={String(row.widthPct)}
                      className={`absolute top-0 h-full rounded ${BAR_TINT[row.status]}`}
                      style={{ left: `${row.offsetPct}%`, width: `${row.widthPct}%` }}
                    />
                  </div>
                  <Txt as="span" variant="ui-sm" className="text-right text-neutral3 tabular-nums">
                    {Number(timeDiff.toPrecision(3))}s
                  </Txt>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
