import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { useParkedSessions, useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { liveSessionCounts, periodActivity } from '../periodActivity';
import type { ActivityPeriod, RunStarts } from '../periodActivity';
import { useRunStarts } from './useRunStarts';

export interface RunsState {
  status: 'pending' | 'error' | 'success';
  complete: boolean;
}

const NO_RUN_STARTS: RunStarts = { starts: [], completeAfter: Number.NEGATIVE_INFINITY };

export function useFactoryActivity(factoryId: string, period: ActivityPeriod) {
  const workItems = useWorkItemsQuery(factoryId);
  const runs = useRunStarts(factoryId, period);
  const running = useActiveRunResourceIds(AGENT_CONTROLLER_ID);
  const parked = useParkedSessions(factoryId);
  const cards = workItems.data ?? [];
  const activity = periodActivity({
    period,
    now: Math.max(workItems.dataUpdatedAt, runs.dataUpdatedAt),
    cards,
    runStarts: runs.data ?? NO_RUN_STARTS,
  });
  const runsState: RunsState = { status: runs.status, complete: activity.ranComplete };
  return {
    hasCards: cards.length > 0,
    activity,
    runs: runsState,
    live: liveSessionCounts(cards, running, parked),
  };
}
