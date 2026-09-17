import { useEffect, useState } from 'react';
import { Txt } from '@/ds/components/Txt';
import { toSigFigs } from '@/utils/number';

interface WorkflowClockProps {
  startedAt: number;
  endedAt?: number;
  isRunning?: boolean;
}

export const WorkflowClock = ({ startedAt, endedAt, isRunning = false }: WorkflowClockProps) => {
  if (isRunning && endedAt === undefined && Number.isFinite(startedAt)) {
    return <RunningWorkflowClock key={startedAt} startedAt={startedAt} />;
  }
  return <ElapsedTime startedAt={startedAt} endedAt={endedAt} />;
};

function RunningWorkflowClock({ startedAt }: Pick<WorkflowClockProps, 'startedAt'>) {
  const [time, setTime] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTime(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);
  return <ElapsedTime startedAt={startedAt} endedAt={time} />;
}

function ElapsedTime({ startedAt, endedAt }: Pick<WorkflowClockProps, 'startedAt' | 'endedAt'>) {
  const duration = endedAt === undefined ? NaN : endedAt - startedAt;
  const timeDiff = Number.isFinite(duration) && duration >= 0 ? duration : undefined;

  return (
    <Txt variant="ui-xs" className="text-neutral3 font-mono whitespace-nowrap">
      {timeDiff === undefined ? <span aria-label="Timing unavailable">—</span> : `${toSigFigs(timeDiff, 3)}ms`}
    </Txt>
  );
}
