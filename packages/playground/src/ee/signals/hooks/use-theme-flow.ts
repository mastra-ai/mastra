import { useQuery } from '@tanstack/react-query';

import { fetchThemeFlow, getEntityLearningConfig } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { requireEntityLearningConfig } from './utils';

export function useThemeFlow(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotId: string | undefined,
) {
  const config = getEntityLearningConfig();

  return useQuery({
    queryKey: ['entity-learning', config?.projectId, entityType, entityId, 'theme-flow', signalNames, snapshotId],
    queryFn: () =>
      fetchThemeFlow(
        requireEntityLearningConfig(config),
        entityId,
        entityType,
        signalNames,
        requireSnapshot(snapshotId),
      ),
    enabled: config !== undefined && signalNames.length >= 2 && snapshotId !== undefined,
  });
}

function requireSnapshot(snapshotId: string | undefined) {
  if (!snapshotId) throw new Error('A theme snapshot is required');
  return snapshotId;
}
