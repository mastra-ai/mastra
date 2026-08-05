import { useQuery } from '@tanstack/react-query';

import { fetchNoiseExamples, serializeThemeFilters } from '../entity-learning-api';
import type { ThemeSelection } from '../theme-drilldown-data';
import type { TraceSignalName } from '../types';

export function useNoiseExamples(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName | undefined,
  snapshotId: string | undefined,
  limit = 20,
  offset = 0,
  filters: ThemeSelection[] = [],
) {
  const filterThemes = serializeThemeFilters(filters);
  return useQuery({
    queryKey: [
      'entity-learning',
      entityType,
      entityId,
      'noise-examples',
      signalName,
      snapshotId,
      limit,
      offset,
      filterThemes,
    ],
    queryFn: () => {
      if (!signalName || !snapshotId) throw new Error('Noise example queries require a trace signal and snapshot');
      return fetchNoiseExamples(entityId, entityType, signalName, snapshotId, limit, offset, filters);
    },
    enabled: signalName !== undefined && snapshotId !== undefined,
  });
}
