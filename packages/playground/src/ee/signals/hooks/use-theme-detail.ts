import { useQuery } from '@tanstack/react-query';

import { fetchThemeDetail } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { isNumericThemeId, requireNumericThemeId, requireSnapshotId } from './theme-query-guards';

export function useThemeDetail(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  snapshotId: string | undefined,
  themeId: string | undefined,
) {
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'theme-detail', signalName, snapshotId, themeId],
    queryFn: () =>
      fetchThemeDetail(entityId, entityType, signalName, requireSnapshotId(snapshotId), requireNumericThemeId(themeId)),
    enabled: snapshotId !== undefined && isNumericThemeId(themeId),
  });
}
