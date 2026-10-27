import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { activityStart } from '../periodActivity';
import type { ActivityPeriod } from '../periodActivity';
import { fetchAuditEvents, MAX_AUDIT_PAGE_SIZE } from '../services/audit';

const MAX_PAGES = 20;

interface RunStarts {
  starts: number[];
  complete: boolean;
}

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
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const { events, nextCursor } = await fetchAuditEvents(baseUrl, factoryId, {
          actions: ['factory.run.started'],
          limit: MAX_AUDIT_PAGE_SIZE,
          before,
          signal,
        });
        starts.push(...events.map(event => Date.parse(event.occurredAt)));
        const oldest = events.at(-1);
        if (!nextCursor || !oldest || Date.parse(oldest.occurredAt) < from) return { starts, complete: true };
        before = nextCursor;
      }
      return { starts, complete: false };
    },
  });
}
