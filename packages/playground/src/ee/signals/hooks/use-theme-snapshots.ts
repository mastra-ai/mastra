import { useQuery } from '@tanstack/react-query';

import { fetchThemeSnapshots } from '../entity-learning-api';
import type { TraceSignalName } from '../types';

export function useThemeSnapshots(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  dateFrom?: Date,
  dateTo?: Date,
) {
  const from = dateFrom?.toISOString();
  const to = dateTo?.toISOString();
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'theme-snapshots', signalNames, from, to],
    queryFn: () => fetchThemeSnapshots(entityId, entityType, signalNames, dateFrom, dateTo),
    enabled: signalNames.length >= 2,
    staleTime: 30_000,
  });
}
