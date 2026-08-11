import { useQuery } from '@tanstack/react-query';

import { fetchThemeFlow } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { useTraceIntelligence } from '../use-trace-intelligence';

export function useThemeFlow(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotId: string | undefined,
) {
  const { request } = useTraceIntelligence();
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'theme-flow', signalNames, snapshotId],
    queryFn: () => fetchThemeFlow(request, entityId, entityType, signalNames, requireSnapshot(snapshotId)),
    enabled: signalNames.length >= 2 && snapshotId !== undefined,
  });
}

function requireSnapshot(snapshotId: string | undefined) {
  if (!snapshotId) throw new Error('A theme snapshot is required');
  return snapshotId;
}
