import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '../../../../api/keys';
import { useSessionActivityQuery } from '../../../../hooks/useSessionRows';
import { playDoneSound } from '../../settings/services/doneSound';

const runningByFactory = new Map<string, ReadonlySet<string>>();

export function resetSessionRunObserverForTests(): void {
  runningByFactory.clear();
}

/** A session's run ending rings the done sound once and refreshes the sidebar's rows. */
export function SessionRunObserver({ factoryId }: { factoryId: string | undefined }) {
  const queryClient = useQueryClient();
  const { data } = useSessionActivityQuery(factoryId);

  useEffect(() => {
    if (!data || !factoryId) return;
    const running = new Set(data.runningSessionIds);
    const wasRunning = runningByFactory.get(factoryId) ?? running;
    runningByFactory.set(factoryId, running);
    if ([...wasRunning].every(sessionId => running.has(sessionId))) return;
    playDoneSound();
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessionRowsRoot(factoryId) });
  }, [data, queryClient, factoryId]);

  return null;
}
