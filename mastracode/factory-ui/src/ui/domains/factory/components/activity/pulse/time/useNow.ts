import { useEffect, useState } from 'react';

export function useNow(stepMs: number | undefined): number {
  const [nowMs, setNowMs] = useState(Date.now);

  useEffect(() => {
    if (stepMs === undefined) return;
    const timer = setTimeout(() => setNowMs(Date.now()), Math.max(0, nowMs + stepMs - Date.now()));
    return () => clearTimeout(timer);
  }, [stepMs, nowMs]);

  return nowMs;
}
