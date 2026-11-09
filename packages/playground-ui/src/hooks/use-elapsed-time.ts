import { useEffect, useState } from 'react';

/** Milliseconds elapsed since `isActive` became true (or since `startTime`), refreshed every 100ms. */
export function useElapsedTime(isActive: boolean, startTime?: number) {
  const [state, setState] = useState({ isActive, elapsed: 0 });

  if (state.isActive !== isActive) {
    setState({ isActive, elapsed: 0 });
  }

  useEffect(() => {
    if (!isActive) return;
    const start = startTime ?? Date.now();
    setState({ isActive, elapsed: Date.now() - start });
    const interval = setInterval(() => {
      setState(current => ({ ...current, elapsed: Date.now() - start }));
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, startTime]);

  return state.isActive === isActive ? state.elapsed : 0;
}
