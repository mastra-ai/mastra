import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { getWorkItemSessionRepository } from '../services/workItems';
import type { WorkItem } from '../services/workItems';

export function useCardSessionRepository(factoryId: string, card: Pick<WorkItem, 'id' | 'updatedAt'> | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.workItemSessionRepository(factoryId, card?.id, card?.updatedAt),
    queryFn: card ? ({ signal }) => getWorkItemSessionRepository(baseUrl, factoryId, card.id, signal) : skipToken,
    // Keyed by the card's revision, so a card refresh shows the last answer until the new one lands.
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
