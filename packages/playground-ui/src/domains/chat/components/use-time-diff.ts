import { useEffect, useState } from 'react';

interface UseTimeDiffProps {
  startedAt: number;
  endedAt?: number;
}

export const useTimeDiff = ({ startedAt, endedAt }: UseTimeDiffProps) => {
  const [time, setTime] = useState(startedAt);

  useEffect(() => {
    // Reset to startedAt on (re-)mount or when starts get reused.
    setTime(startedAt);

    // Once the run has ended, stop ticking — completed dialogs would otherwise
    // re-render every 100ms forever.
    if (endedAt != null) return;

    const interval = setInterval(() => {
      setTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, [startedAt, endedAt]);

  const timeDiff = endedAt != null ? endedAt - startedAt : time - startedAt;

  return timeDiff;
};
