import { useQuery } from '@tanstack/react-query';

import { fetchThemeHistory } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { isNumericThemeId, requireNumericThemeId } from './theme-query-guards';

export function useThemeHistory(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  themeId: string | undefined,
  limit = 100,
) {
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'theme-history', signalName, themeId, limit],
    queryFn: () => fetchThemeHistory(entityId, entityType, signalName, requireNumericThemeId(themeId), limit),
    enabled: isNumericThemeId(themeId),
  });
}
