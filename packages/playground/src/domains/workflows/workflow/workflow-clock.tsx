import { Txt } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';

import { formatTimelineDuration } from './workflow-timeline-utils';

interface ClockProps {
  startedAt: number;
  endedAt?: number;
}

export const Clock = ({ startedAt, endedAt }: ClockProps) => {
  const [time, setTime] = useState(startedAt);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, [startedAt]);

  const durationMs = endedAt ? endedAt - startedAt : time - startedAt;

  return (
    <Txt variant="ui-xs" className="font-mono text-neutral3 whitespace-nowrap">
      {formatTimelineDuration(durationMs)}
    </Txt>
  );
};
