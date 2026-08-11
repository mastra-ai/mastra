import { useQuery } from '@tanstack/react-query';

import { fetchNoiseExamples } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { useTraceIntelligence } from '../use-trace-intelligence';

export function useNoiseExamples(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName | undefined,
  snapshotId: string | undefined,
  limit = 20,
  offset = 0,
) {
  const { request } = useTraceIntelligence();
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'noise-examples', signalName, snapshotId, limit, offset],
    queryFn: () => {
      if (!signalName || !snapshotId) throw new Error('Noise example queries require a trace signal and snapshot');
      return fetchNoiseExamples(request, entityId, entityType, signalName, snapshotId, limit, offset);
    },
    enabled: signalName !== undefined && snapshotId !== undefined,
  });
}
