import { useQuery } from '@tanstack/react-query';

import { fetchEntityLearningProgress } from '../entity-learning-api';

export function useEntityLearningProgress(entityId: string | undefined, entityType: string, enabled = true) {
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'progress'],
    queryFn: () => fetchEntityLearningProgress(entityId ?? '', entityType),
    enabled: enabled && Boolean(entityId),
  });
}
