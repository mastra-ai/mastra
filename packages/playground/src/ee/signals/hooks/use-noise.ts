import { useQuery } from '@tanstack/react-query';

import { fetchNoise } from '../entity-learning-api';
import type { TraceSignalName } from '../types';

export function useNoise(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName | undefined,
  snapshotId: string | undefined,
) {
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'noise', signalName, snapshotId],
    queryFn: () => {
      if (!signalName || !snapshotId) throw new Error('Noise queries require a signal and snapshot');
      return fetchNoise(entityId, entityType, signalName, snapshotId);
    },
    enabled: signalName !== undefined && snapshotId !== undefined,
  });
}
