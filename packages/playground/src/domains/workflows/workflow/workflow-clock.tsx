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

  const timeDiff = (endedAt ? endedAt - startedAt : time - startedAt) / 1000;

  return <span className="text-xs text-neutral3">{Number(timeDiff.toPrecision(3))}s</span>;
};
