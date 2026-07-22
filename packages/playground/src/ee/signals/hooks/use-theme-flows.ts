import { useQueries } from '@tanstack/react-query';

import { fetchThemeFlow } from '../entity-learning-api';
import type { TraceSignalName } from '../types';

export function useThemeFlows(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotIds: string[],
) {
  return useQueries({
    queries: snapshotIds.map(snapshotId => ({
      queryKey: ['entity-learning', entityType, entityId, 'theme-flow', signalNames, snapshotId],
      queryFn: () => fetchThemeFlow(entityId, entityType, signalNames, snapshotId),
      enabled: signalNames.length >= 2,
    })),
  });
}
