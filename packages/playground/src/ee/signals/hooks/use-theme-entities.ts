import { useQuery } from '@tanstack/react-query';

import { fetchThemeEntities, getEntityLearningConfig } from '../entity-learning-api';
import { requireEntityLearningConfig } from './utils';

export function useThemeEntities(entityType: string) {
  const config = getEntityLearningConfig();

  return useQuery({
    queryKey: ['entity-learning', config?.baseUrl, config?.projectId, 'entities', entityType],
    queryFn: () => fetchThemeEntities(requireEntityLearningConfig(config), entityType),
    enabled: config !== undefined,
  });
}
