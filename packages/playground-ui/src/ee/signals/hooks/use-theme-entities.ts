import { useQuery } from '@tanstack/react-query';

import { fetchThemeEntities } from '../entity-learning-api';
import { useTraceIntelligence } from '../use-trace-intelligence';

export function useThemeEntities(entityType: string) {
  const { request } = useTraceIntelligence();
  return useQuery({
    queryKey: ['entity-learning', 'entities', entityType],
    queryFn: () => fetchThemeEntities(request, entityType),
  });
}
