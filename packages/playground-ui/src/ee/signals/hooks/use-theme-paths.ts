import { useQuery } from '@tanstack/react-query';

import { fetchThemePaths } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { useTraceIntelligence } from '../use-trace-intelligence';
import { isNumericThemeId, requireSnapshotId } from './theme-query-guards';

export function useThemePaths(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotId: string | undefined,
  themeId: string | undefined,
) {
  const { request } = useTraceIntelligence();
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'theme-paths', signalNames, snapshotId],
    queryFn: () => fetchThemePaths(request, entityId, entityType, signalNames, requireSnapshotId(snapshotId)),
    enabled: snapshotId !== undefined && isNumericThemeId(themeId),
    staleTime: 30_000,
  });
}
