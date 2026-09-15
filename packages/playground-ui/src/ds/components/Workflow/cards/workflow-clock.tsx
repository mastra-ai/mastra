import { useEffect, useState } from 'react';
import { Txt } from '@/ds/components/Txt';
import { toSigFigs } from '@/utils/number';

interface WorkflowClockProps {
  startedAt: number;
  endedAt?: number;
  isRunning?: boolean;
}

export const WorkflowClock = ({ startedAt, endedAt, isRunning = false }: WorkflowClockProps) => {
  const [time, setTime] = useState(() => Date.now());
  const needsClock = isRunning && endedAt === undefined && Number.isFinite(startedAt);

  useEffect(() => {
    if (!needsClock) return;
    const interval = setInterval(() => setTime(Date.now()), 100);
    return () => clearInterval(interval);
  }, [needsClock]);

  const end = endedAt ?? (isRunning ? time : undefined);
  const duration = end === undefined ? NaN : end - startedAt;
  const timeDiff = Number.isFinite(duration) && duration >= 0 ? duration : undefined;

  return (
    <Txt variant="ui-xs" className="font-mono whitespace-nowrap text-neutral3">
      {timeDiff === undefined ? <span aria-label="Timing unavailable">—</span> : `${toSigFigs(timeDiff, 3)}ms`}
    </Txt>
  );
};
