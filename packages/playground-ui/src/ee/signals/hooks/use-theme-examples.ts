import { useQuery } from '@tanstack/react-query';

import { fetchThemeExamples } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { useTraceIntelligence } from '../use-trace-intelligence';
import { isNumericThemeId, requireNumericThemeId, requireSnapshotId } from './theme-query-guards';

export function useThemeExamples(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  snapshotId: string | undefined,
  themeId: string | undefined,
  limit = 20,
  offset = 0,
) {
  const { request } = useTraceIntelligence();
  return useQuery({
    queryKey: [
      'entity-learning',
      entityType,
      entityId,
      'theme-examples',
      signalName,
      snapshotId,
      themeId,
      limit,
      offset,
    ],
    queryFn: () =>
      fetchThemeExamples(
        request,
        entityId,
        entityType,
        signalName,
        requireSnapshotId(snapshotId),
        requireNumericThemeId(themeId),
        limit,
        offset,
      ),
    enabled: snapshotId !== undefined && isNumericThemeId(themeId),
  });
}
