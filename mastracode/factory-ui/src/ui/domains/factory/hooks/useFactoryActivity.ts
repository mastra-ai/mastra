import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { useLookedUpWorkItems, useParkedSessions } from '../../../../hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { activityStart, liveSessionCounts, periodActivity } from '../periodActivity';
import type { ActivityPeriod, CardTimes, RunStarts } from '../periodActivity';
import { getWorkItemActivity } from '../services/workItems';
import { isTerminalStage } from '../stages';
import { useRunStarts } from './useRunStarts';

export interface RunsState {
  status: 'pending' | 'error' | 'success';
  complete: boolean;
}

const NO_RUN_STARTS: RunStarts = { starts: [], completeAfter: Number.NEGATIVE_INFINITY };
const NO_CARD_TIMES: CardTimes = { cameIn: [], shipped: [] };

/** When cards came in and shipped over the period, read as timestamps: the board holds only open cards. */
function useCardTimes(factoryId: string, period: ActivityPeriod) {
  const { baseUrl } = useApiConfig();
  const depth: ActivityPeriod = period === 'month' ? 'month' : 'week';
  return useQuery({
    queryKey: queryKeys.workItemActivity(factoryId, depth),
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const data = await getWorkItemActivity(baseUrl, factoryId, new Date(activityStart(depth, Date.now())), signal);
      const cardTimes: CardTimes = { cameIn: data.createdAt.map(Date.parse), shipped: data.doneAt.map(Date.parse) };
      return { total: data.total, cardTimes };
    },
  });
}

export function useFactoryActivity(factoryId: string, period: ActivityPeriod) {
  const times = useCardTimes(factoryId, period);
  const runs = useRunStarts(factoryId, period);
  const running = useActiveRunResourceIds(AGENT_CONTROLLER_ID);
  const parked = useParkedSessions(factoryId);
  // Only cards holding a live session can count as working or waiting, so read just those.
  const liveIds = [...running, ...parked];
  const liveCards = useLookedUpWorkItems(factoryId, liveIds.length > 0 ? { kind: 'session', ids: liveIds } : undefined);
  const openCards = liveCards.data.filter(card => !card.stages.some(isTerminalStage));
  const activity = periodActivity({
    period,
    now: Math.max(times.dataUpdatedAt, runs.dataUpdatedAt),
    cardTimes: times.data?.cardTimes ?? NO_CARD_TIMES,
    runStarts: runs.data ?? NO_RUN_STARTS,
  });
  const runsState: RunsState = { status: runs.status, complete: activity.ranComplete };
  return {
    hasCards: (times.data?.total ?? 0) > 0,
    activity,
    runs: runsState,
    live: liveSessionCounts(openCards, running, parked),
  };
}
