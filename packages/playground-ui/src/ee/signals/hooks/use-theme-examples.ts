import { useQuery } from '@tanstack/react-query';

import { fetchThemeExamples, serializeThemeFilters } from '../entity-learning-api';
import type { ThemeSelection } from '../theme-drilldown-data';
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
      'theme-examples',
      signalName,
      snapshotId,
      themeId,
      limit,
      offset,
      serializedFilters,
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
        filterThemes,
      ),
    enabled: snapshotId !== undefined && isNumericThemeId(themeId),
  });
}
