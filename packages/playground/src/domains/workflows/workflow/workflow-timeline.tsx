import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { useAutoscroll } from '@mastra/playground-ui/hooks/use-autoscroll';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChartNoAxesGantt, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCurrentRun } from '../context/use-current-run';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { WorkflowTimelineRow } from './workflow-timeline-row';
import { buildTimeline } from './workflow-timeline-utils';

export function WorkflowTimeline() {
  const { steps } = useCurrentRun();
  const { selectedStepId, hoverStepId, setSelectedStepId, setHoverStepId } = useWorkflowSelectedStep();
  const [now, setNow] = useState(() => Date.now());
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const { showData } = useWorkflowStepDetail();
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = buildTimeline(steps, now);
  const hasRunning = rows.some(row => row.isRunning);
  useAutoscroll(scrollRef, { enabled: hasRunning && !isCollapsed });

  useEffect(() => {
    if (!hasRunning || isCollapsed) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [hasRunning, isCollapsed]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div data-testid="workflow-timeline" className="relative z-20 shrink-0 px-2 pb-2">
      <Collapsible
        open={!isCollapsed}
        onOpenChange={open => setIsCollapsed(!open)}
        className={cn(
          raisedSurfaceStyle,
          '@container/workflow-timeline pointer-events-auto overflow-hidden rounded-xl',
        )}
      >
        <div className="flex items-center">
          <CollapsibleTrigger
            className="hover:bg-fill-subtle text-caption text-foreground flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3.5 py-2.5"
            aria-label={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
          >
            <span>
              <ChartNoAxesGantt aria-hidden className="text-muted-foreground size-4" />
            </span>
            <span>Timeline</span>
            <span className="text-muted-foreground text-meta">{rows.length} events</span>
            <span className="ml-auto">
              <ChevronDown
                aria-hidden
                className={cn('size-4 transition-transform motion-reduce:transition-none', isCollapsed && '-rotate-90')}
              />
            </span>
          </CollapsibleTrigger>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon-sm"
              tooltip={isEnlarged ? 'Restore timeline height' : 'Enlarge timeline'}
              aria-pressed={isEnlarged}
              onClick={() => setIsEnlarged(!isEnlarged)}
              className="mr-2 shrink-0"
            >
              {isEnlarged ? <ChevronsDownUp /> : <ChevronsUpDown />}
            </Button>
          )}
        </div>
        <CollapsibleContent>
          <div
            ref={scrollRef}
            data-testid="workflow-timeline-list"
            className={cn(
              'overflow-auto overscroll-contain px-1.5 pb-1.5',
              isEnlarged ? 'max-h-[min(720px,calc(100dvh-112px))]' : 'max-h-[min(320px,40dvh)]',
            )}
          >
            {rows.map(row => (
              <WorkflowTimelineRow
                key={row.stepId}
                row={row}
                isSelected={selectedStepId === row.stepId}
                isHovered={hoverStepId === row.stepId}
                onSelectStep={setSelectedStepId}
                onHoverStep={setHoverStepId}
                onOpenInput={(timelineRow, trigger) =>
                  showData({ type: 'step-input', stepId: timelineRow.stepId }, trigger)
                }
                onOpenOutput={(timelineRow, trigger) =>
                  showData({ type: 'step-output', stepId: timelineRow.stepId }, trigger)
                }
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
