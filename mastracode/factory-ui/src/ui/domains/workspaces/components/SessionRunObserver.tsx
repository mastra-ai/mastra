import { useEffect } from 'react';

import { useSessionActivityQuery } from '../../../../hooks/useSessionRows';
import { playDoneSound } from '../../settings/services/doneSound';

const runningByFactory = new Map<string, ReadonlySet<string>>();

export function resetSessionRunObserverForTests(): void {
  runningByFactory.clear();
}

export function SessionRunObserver({ factoryId }: { factoryId: string | undefined }) {
  const { data } = useSessionActivityQuery(factoryId);

  useEffect(() => {
    if (!data || !factoryId) return;
    const running = new Set(data.runningSessionIds);
    const wasRunning = runningByFactory.get(factoryId) ?? running;
    runningByFactory.set(factoryId, running);
    if ([...wasRunning].some(sessionId => !running.has(sessionId))) playDoneSound();
  }, [data, factoryId]);

  return null;
}
