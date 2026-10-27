import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { useParkedSessions, useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { liveSessionCounts, periodActivity } from '../periodActivity';
import type { ActivityPeriod } from '../periodActivity';
import { useRunStarts } from './useRunStarts';

export interface RunsState {
  status: 'pending' | 'error' | 'success';
  complete: boolean;
}

export function useFactoryActivity(factoryId: string, period: ActivityPeriod) {
  const workItems = useWorkItemsQuery(factoryId);
  const runs = useRunStarts(factoryId, period);
  const running = useActiveRunResourceIds(AGENT_CONTROLLER_ID);
  const parked = useParkedSessions(factoryId);
  const cards = workItems.data ?? [];
  const runsState: RunsState = { status: runs.status, complete: runs.data?.complete ?? true };
  return {
    hasCards: cards.length > 0,
    activity: periodActivity({
      period,
      now: Math.max(workItems.dataUpdatedAt, runs.dataUpdatedAt),
      cards,
      runStarts: runs.data?.starts ?? [],
    }),
    runs: runsState,
    live: liveSessionCounts(cards, running, parked),
  };
}
