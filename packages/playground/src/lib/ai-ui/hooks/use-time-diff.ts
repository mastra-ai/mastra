import { useEffect, useState } from 'react';

interface UseTimeDiffProps {
  startedAt: number;
  endedAt?: number;
}

export const useTimeDiff = ({ startedAt, endedAt }: UseTimeDiffProps) => {
  const [time, setTime] = useState(startedAt);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, [startedAt]);

  const timeDiff = endedAt ? endedAt - startedAt : time - startedAt;

  return timeDiff;
};
