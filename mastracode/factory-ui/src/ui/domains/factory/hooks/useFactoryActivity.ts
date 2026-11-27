import { useQuery } from '@tanstack/react-query';

import type { SessionActivity, WorkItemActivity } from '../../../../api/types';
import { useSessionActivityQuery, useFactory, workItemActivityQueryOptions } from '@mastra/react/hooks/factory';
import { activityDepth, periodActivity } from '../periodActivity';
import type { ActivityPeriod, RunStarts } from '../periodActivity';
import { useRunStarts } from './useRunStarts';

export type { RunsState } from '@mastra/playground-ui/domains/factory';
import type { RunsState } from '@mastra/playground-ui/domains/factory';

const NO_RUN_STARTS: RunStarts = { starts: [], completeAfter: Number.NEGATIVE_INFINITY };
const NO_CARD_TIMES: WorkItemActivity = { total: 0, createdAt: [], doneAt: [] };
const NO_LIVE_CARDS: SessionActivity['cards'] = { working: 0, waiting: 0 };

export function useFactoryActivity(factoryId: string, period: ActivityPeriod) {
  const factory = useFactory(factoryId);
  const depth = activityDepth(period);
  const week = useQuery({ ...workItemActivityQueryOptions(factory, 'week'), enabled: depth === 'week' });
  const month = useQuery({ ...workItemActivityQueryOptions(factory, 'month'), enabled: depth === 'month' });
  // A period just chosen has no answer yet: the other depth's stands in, so the band and its menu stay up.
  // The month's instants contain the week's, and the week's show the last seven days of a month still loading.
  const [asked, other] = depth === 'month' ? [month, week] : [week, month];
  const shown = asked.data ? asked : other;
  const cardTimes = shown.data ?? NO_CARD_TIMES;
  const runs = useRunStarts(factoryId, period);
  const live = useSessionActivityQuery(factoryId).data?.cards ?? NO_LIVE_CARDS;
  const activity = periodActivity({
    period,
    now: Math.max(shown.dataUpdatedAt, runs.dataUpdatedAt),
    cardTimes,
    runStarts: runs.data ?? NO_RUN_STARTS,
  });
  const runsState: RunsState = { status: runs.status, complete: activity.ranComplete };
  return {
    // A server too old to count cards answers 404: the band then stays hidden.
    hasCards: cardTimes.total > 0,
    activity,
    runs: runsState,
    live,
  };
}
