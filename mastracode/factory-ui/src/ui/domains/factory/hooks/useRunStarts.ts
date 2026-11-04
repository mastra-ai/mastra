import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { activityStart } from '../periodActivity';
import type { ActivityPeriod, RunStarts } from '../periodActivity';
import { fetchAuditEvents, MAX_AUDIT_PAGE_SIZE } from '../services/audit';

const MAX_PAGES = 20;

export function useRunStarts(factoryId: string, period: ActivityPeriod) {
  const { baseUrl } = useApiConfig();
  const depth: ActivityPeriod = period === 'month' ? 'month' : 'week';
  return useQuery({
    queryKey: queryKeys.factoryAudit(factoryId, 'run-starts', depth),
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<RunStarts> => {
      const from = activityStart(depth, Date.now());
      const starts: number[] = [];
      let before: string | undefined;
      for (let page = 1; ; page += 1) {
        const { events, nextCursor } = await fetchAuditEvents(baseUrl, factoryId, {
          actions: ['factory.run.started'],
          limit: MAX_AUDIT_PAGE_SIZE,
          before,
          signal,
        });
        starts.push(...events.map(event => Date.parse(event.occurredAt)));
        const oldest = events.at(-1);
        if (!nextCursor || !oldest) return { starts, completeAfter: Number.NEGATIVE_INFINITY };
        const oldestAt = Date.parse(oldest.occurredAt);
        if (oldestAt < from || page === MAX_PAGES) return { starts, completeAfter: oldestAt };
        before = nextCursor;
      }
    },
  });
}
