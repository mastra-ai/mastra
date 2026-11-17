import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { getWorkItemSessionRepository } from '../services/workItems';
import type { WorkItem } from '../services/workItems';

export function useCardSessionRepository(factoryId: string, card: Pick<WorkItem, 'id' | 'updatedAt'>) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.workItemSessionRepository(factoryId, card.id, card.updatedAt),
    queryFn: ({ signal }) => getWorkItemSessionRepository(baseUrl, factoryId, card.id, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
