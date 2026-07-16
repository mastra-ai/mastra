import { useQuery } from '@tanstack/react-query';

import { fetchThemeSnapshots, getEntityLearningConfig } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { requireEntityLearningConfig } from './utils';

export function useThemeSnapshots(entityId: string, entityType: string, signalNames: TraceSignalName[]) {
  const config = getEntityLearningConfig();

  return useQuery({
    queryKey: ['entity-learning', config?.projectId, entityType, entityId, 'theme-snapshots', signalNames],
    queryFn: () => fetchThemeSnapshots(requireEntityLearningConfig(config), entityId, entityType, signalNames),
    enabled: config !== undefined && signalNames.length >= 2,
  });
}
