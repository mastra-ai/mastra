import { useQuery } from '@tanstack/react-query';

import { fetchEntityLearningProgress } from '../entity-learning-api';
import { useTraceIntelligence } from '../use-trace-intelligence';

export function useEntityLearningProgress(entityId: string | undefined, entityType: string, enabled = true) {
  const { request } = useTraceIntelligence();
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'progress'],
    queryFn: () => fetchEntityLearningProgress(request, entityId ?? '', entityType),
    enabled: enabled && Boolean(entityId),
  });
}
