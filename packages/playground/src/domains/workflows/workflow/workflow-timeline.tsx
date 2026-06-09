import { CheckIcon, CrossIcon, Icon, isObjectEmpty, toSigFigs, Txt, useAutoscroll } from '@mastra/playground-ui';
import { CirclePause, HourglassIcon, Loader2 } from 'lucide-react';
import { useContext, useEffect, useRef, useState } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import type { Step } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowJsonDialog } from './workflow-json-dialog';
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
  const { result } = useContext(WorkflowRunContext);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  useAutoscroll(scrollRef, { enabled: true });

  const rows = buildTimeline(steps, now);
  const hasRunning = rows.some(row => row.isRunning);

  useEffect(() => {
    if (!hasRunning) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [hasRunning]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div data-testid="workflow-timeline" className="shrink-0 px-2 pb-2">
      <div className="-ml-2 flex max-h-64 w-full min-w-0 flex-col gap-3 overflow-hidden rounded-studio-panel border border-border1/50 bg-surface3 p-4">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Txt as="p" variant="ui-md" className="text-neutral3">
            Timeline
          </Txt>
          {result && !isObjectEmpty(result) && <WorkflowJsonDialog result={result} />}
        </div>
        <div ref={scrollRef} className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {rows.map((row, index) => (
            <div
              key={`timeline-item-${row.stepId}-${index}`}
              data-testid="workflow-timeline-row"
              className="grid grid-cols-[10rem_minmax(0,1fr)_5rem] items-center gap-3"
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
                {toSigFigs(row.durationMs, 3)}ms
              </Txt>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
