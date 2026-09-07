import { useQueries } from '@tanstack/react-query';

import { fetchThemeFlow } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { useTraceIntelligence } from '../use-trace-intelligence';

export function useThemeFlows(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotIds: string[],
) {
  const { cacheScope, request } = useTraceIntelligence();
  return useQueries({
    queries: snapshotIds.map(snapshotId => ({
      queryKey: ['entity-learning', cacheScope, entityType, entityId, 'theme-flow', signalNames, snapshotId],
      queryFn: () => fetchThemeFlow(request, entityId, entityType, signalNames, snapshotId),
      enabled: signalNames.length >= 2,
      staleTime: 30_000,
    })),
  });
}
