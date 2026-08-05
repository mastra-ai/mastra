import { useQuery } from '@tanstack/react-query';

import { fetchThemePaths } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { requireSnapshotId } from './theme-query-guards';

export function useThemePaths(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'theme-paths', signalNames, snapshotId],
    queryFn: () => fetchThemePaths(entityId, entityType, signalNames, requireSnapshotId(snapshotId)),
    enabled: snapshotId !== undefined && enabled,
    staleTime: 30_000,
  });
}
