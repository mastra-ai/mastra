import { useQuery } from '@tanstack/react-query';

import { fetchNoiseExamples, serializeThemeFilters } from '../entity-learning-api';
import type { ThemeSelection } from '../theme-drilldown-data';
import type { TraceSignalName } from '../types';
import { useTraceIntelligence } from '../use-trace-intelligence';

export function useNoiseExamples(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName | undefined,
  snapshotId: string | undefined,
  limit = 20,
  offset = 0,
  filterThemes: ThemeSelection[] = [],
) {
  const { cacheScope, request } = useTraceIntelligence();
  const serializedFilters = serializeThemeFilters(filterThemes);
  return useQuery({
    queryKey: [
      'entity-learning',
      cacheScope,
      entityType,
      entityId,
      'noise-examples',
      signalName,
      snapshotId,
      limit,
      offset,
      serializedFilters,
    ],
    queryFn: () => {
      if (!signalName || !snapshotId) throw new Error('Noise example queries require a trace signal and snapshot');
      return fetchNoiseExamples(request, entityId, entityType, signalName, snapshotId, limit, offset, filterThemes);
    },
    enabled: signalName !== undefined && snapshotId !== undefined,
  });
}
