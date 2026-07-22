import { useQuery } from '@tanstack/react-query';

import { fetchNoiseExamples } from '../entity-learning-api';
import type { TraceSignalName } from '../types';

export function useNoiseExamples(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName | undefined,
  snapshotId: string | undefined,
  limit = 20,
  offset = 0,
) {
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'noise-examples', signalName, snapshotId, limit, offset],
    queryFn: () => {
      if (!signalName || !snapshotId) throw new Error('Noise example queries require a signal and snapshot');
      return fetchNoiseExamples(entityId, entityType, signalName, snapshotId, limit, offset);
    },
    enabled: signalName !== undefined && snapshotId !== undefined,
  });
}
