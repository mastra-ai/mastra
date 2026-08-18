import { Txt } from '@mastra/playground-ui/components/Txt';
import { toSigFigs } from '@mastra/playground-ui/utils/number';
import { useEffect, useState } from 'react';

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

  const timeDiff = endedAt ? endedAt - startedAt : time - startedAt;

  return (
    <Txt variant="ui-xs" className="text-neutral3 font-mono whitespace-nowrap">
      {toSigFigs(timeDiff, 3)}ms
    </Txt>
  );
};
