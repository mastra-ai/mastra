import { useQuery } from '@tanstack/react-query';

import { fetchNoise } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { useTraceIntelligence } from '../use-trace-intelligence';

export function useNoise(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName | undefined,
  snapshotId: string | undefined,
) {
  const { cacheScope, request } = useTraceIntelligence();
  return useQuery({
    queryKey: ['entity-learning', cacheScope, entityType, entityId, 'noise', signalName, snapshotId],
    queryFn: () => {
      if (!signalName || !snapshotId) throw new Error('Noise queries require a trace signal and snapshot');
      return fetchNoise(request, entityId, entityType, signalName, snapshotId);
    },
    enabled: signalName !== undefined && snapshotId !== undefined,
  });
}
