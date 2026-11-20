import { ROOT_ENTITY_TYPES } from '@mastra/react/hooks/traces';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useQuery } from '@tanstack/react-query';
import { DISCOVERY_STALE_TIME, listObservabilityValues } from './list-observability-values';

/**
 * Entity names for one entity type, or for every root entity type with `rootOnly` (Studio's
 * `useEntityNames` options), merged, deduplicated and sorted.
 */
export function useMcpEntityNames(
  app: App,
  { entityType, rootOnly = false }: { entityType?: string; rootOnly?: boolean } = {},
) {
  return useQuery({
    queryKey: entityType
      ? ['mcp-observability-entity-names', 'by-type', entityType]
      : ['mcp-observability-entity-names', 'all', rootOnly],
    queryFn: async () => {
      if (entityType || !rootOnly) return listObservabilityValues(app, 'entityNames', entityType ? { entityType } : {});
      const names = await Promise.all(
        Object.values(ROOT_ENTITY_TYPES).map(type => listObservabilityValues(app, 'entityNames', { entityType: type })),
      );
      return Array.from(new Set(names.flat())).sort();
    },
    staleTime: DISCOVERY_STALE_TIME,
    retry: false,
  });
}
