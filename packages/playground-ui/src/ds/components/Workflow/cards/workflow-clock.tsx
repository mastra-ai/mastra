import { useEffect, useState } from 'react';
import { Txt } from '@/ds/components/Txt';
import { formatDuration } from '@/utils/duration';

interface WorkflowClockProps {
  startedAt: number;
  endedAt?: number;
  isRunning?: boolean;
  spansSuspension?: boolean;
}

export const WorkflowClock = ({ startedAt, endedAt, isRunning = false, spansSuspension }: WorkflowClockProps) => {
  if (isRunning && endedAt === undefined && Number.isFinite(startedAt)) {
    return <RunningWorkflowClock key={startedAt} startedAt={startedAt} spansSuspension={spansSuspension} />;
  }
  return <ElapsedTime startedAt={startedAt} endedAt={endedAt} spansSuspension={spansSuspension} />;
};

function RunningWorkflowClock({ startedAt, spansSuspension }: Omit<WorkflowClockProps, 'isRunning'>) {
  const [time, setTime] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTime(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);
  return <ElapsedTime startedAt={startedAt} endedAt={time} spansSuspension={spansSuspension} />;
}

function ElapsedTime({ startedAt, endedAt, spansSuspension }: Omit<WorkflowClockProps, 'isRunning'>) {
  const elapsed = endedAt === undefined ? undefined : formatDuration(endedAt - startedAt);

  return (
    <Txt
      variant="meta"
      tone="muted"
      font="mono"
      className="whitespace-nowrap"
      title={elapsed && spansSuspension ? 'Includes time spent suspended waiting for input' : undefined}
    >
      {elapsed === undefined ? <span aria-label="Timing unavailable">—</span> : elapsed}
    </Txt>
  );
}
