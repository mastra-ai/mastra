import { useQuery } from '@tanstack/react-query';

import { fetchThemeSnapshots } from '../entity-learning-api';
import type { TraceSignalName } from '../types';

export function useThemeSnapshots(entityId: string, entityType: string, signalNames: TraceSignalName[]) {
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'theme-snapshots', signalNames],
    queryFn: () => fetchThemeSnapshots(entityId, entityType, signalNames),
    enabled: signalNames.length >= 2,
  });
}
