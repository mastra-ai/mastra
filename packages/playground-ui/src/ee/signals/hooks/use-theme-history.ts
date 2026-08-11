import { useQuery } from '@tanstack/react-query';

import { fetchThemeHistory } from '../entity-learning-api';
import type { TraceSignalName } from '../types';
import { useTraceIntelligence } from '../use-trace-intelligence';
import { isNumericThemeId, requireNumericThemeId } from './theme-query-guards';

export function useThemeHistory(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  themeId: string | undefined,
  limit = 100,
) {
  const { request } = useTraceIntelligence();
  return useQuery({
    queryKey: ['entity-learning', entityType, entityId, 'theme-history', signalName, themeId, limit],
    queryFn: () => fetchThemeHistory(request, entityId, entityType, signalName, requireNumericThemeId(themeId), limit),
    enabled: isNumericThemeId(themeId),
  });
}
