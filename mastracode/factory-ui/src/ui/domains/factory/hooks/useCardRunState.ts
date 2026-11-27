import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { fetchWorkItemRunState } from '../services/workItems';

/** What the card's board engine recorded it doing; re-read on every feed frame. */
export function useCardRunState(factoryId: string, workItemId: string | undefined, enabled = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.workItemRunState(factoryId, workItemId),
    queryFn:
      workItemId && enabled ? ({ signal }) => fetchWorkItemRunState(baseUrl, factoryId, workItemId, signal) : skipToken,
    select: answer => answer.runState,
    refetchOnWindowFocus: true,
  });
}
