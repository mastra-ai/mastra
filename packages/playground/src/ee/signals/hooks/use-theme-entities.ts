import { useQuery } from '@tanstack/react-query';

import { fetchThemeEntities } from '../entity-learning-api';

export function useThemeEntities(entityType: string) {
  return useQuery({
    queryKey: ['entity-learning', 'entities', entityType],
    queryFn: () => fetchThemeEntities(entityType),
  });
}
