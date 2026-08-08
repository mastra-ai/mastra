import { useQuery } from '@tanstack/react-query';

import { fetchThemeExamples, serializeThemeFilters } from '../entity-learning-api';
import type { ThemeSelection } from '../theme-drilldown-data';
import type { TraceSignalName } from '../types';
import { isNumericThemeId, requireNumericThemeId, requireSnapshotId } from './theme-query-guards';

export function useThemeExamples(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  snapshotId: string | undefined,
  themeId: string | undefined,
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
      'theme-examples',
      signalName,
      snapshotId,
      themeId,
      limit,
      offset,
      filterThemes,
    ],
    queryFn: () =>
      fetchThemeExamples(
        entityId,
        entityType,
        signalName,
        requireSnapshotId(snapshotId),
        requireNumericThemeId(themeId),
        limit,
        offset,
        filters,
      ),
    enabled: snapshotId !== undefined && isNumericThemeId(themeId),
  });
}
