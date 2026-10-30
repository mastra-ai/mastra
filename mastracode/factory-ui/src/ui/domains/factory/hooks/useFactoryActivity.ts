import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { useActivityTimes, useParkedSessions, useWorkItemsWithSessionCards } from '../../../../hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { liveSessionCounts, periodActivity } from '../periodActivity';
import type { ActivityPeriod, ActivityTimes, RunStarts } from '../periodActivity';
import { useRunStarts } from './useRunStarts';

export interface RunsState {
  status: 'pending' | 'error' | 'success';
  complete: boolean;
}

const NO_TIMES: ActivityTimes = { cameIn: [], shipped: [] };
const NO_RUN_STARTS: RunStarts = { starts: [], completeAfter: Number.NEGATIVE_INFINITY };

export function useFactoryActivity(factoryId: string, period: ActivityPeriod) {
  // The board holds only the cards being worked: what came in and shipped is read for the period,
  // and live counts need the cards every session ran on.
  const activityTimes = useActivityTimes(factoryId, period);
  const workItems = useWorkItemsWithSessionCards(factoryId, true);
  const runs = useRunStarts(factoryId, period);
  const running = useActiveRunResourceIds(AGENT_CONTROLLER_ID);
  const parked = useParkedSessions(factoryId);
  const cards = workItems.data ?? [];
  const activity = periodActivity({
    period,
    now: Math.max(activityTimes.dataUpdatedAt, runs.dataUpdatedAt),
    times: activityTimes.data ?? NO_TIMES,
    runStarts: runs.data ?? NO_RUN_STARTS,
  });
  const runsState: RunsState = { status: runs.status, complete: activity.ranComplete };
  return {
    hasCards: cards.length > 0 || (activityTimes.data?.cameIn.length ?? 0) > 0,
    activity,
    runs: runsState,
    live: liveSessionCounts(cards, running, parked),
  };
}
