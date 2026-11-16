import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { getWorkItemSessionRepository } from '../services/workItems';

export function useCardSessionRepository(factoryId: string, workItemId: string) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.workItemSessionRepository(factoryId, workItemId),
    queryFn: ({ signal }) => getWorkItemSessionRepository(baseUrl, factoryId, workItemId, signal),
  });
}
