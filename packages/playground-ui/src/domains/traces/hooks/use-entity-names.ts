import { EntityType } from '@mastra/core/observability';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { ROOT_ENTITY_TYPE_OPTIONS } from '@/domains/traces/trace-filters';

type EntityTypeValue = `${EntityType}`;

type UseEntityNamesOptions = {
  entityType?: EntityTypeValue;
  rootOnly?: boolean;
};

function resolveEntityType(entityType: EntityTypeValue) {
  return Object.values(EntityType).find(candidate => candidate === entityType);
}

export const useEntityNames = ({ entityType, rootOnly = false }: UseEntityNamesOptions = {}) => {
  const client = useMastraClient();

  // Mirror the queryFn branches so the cache key reflects what the server
  // actually returns. rootOnly only matters when entityType is not set; when
  // entityType is set, the query ignores rootOnly entirely.
  const queryKey = entityType
    ? ['observability-entity-names', 'by-type', entityType]
    : ['observability-entity-names', 'all', rootOnly ? 'root-only' : 'all-types'];

  return useQuery({
    queryKey,
    queryFn: async () => {
      try {
        if (entityType) {
          const resolvedEntityType = resolveEntityType(entityType);
          if (!resolvedEntityType) return { names: [] };
          return await client.getEntityNames({ entityType: resolvedEntityType });
        }

        if (!rootOnly) {
          return await client.getEntityNames();
        }

        const responses = await Promise.all(
          ROOT_ENTITY_TYPE_OPTIONS.map(option => {
            const resolvedEntityType = resolveEntityType(option.entityType);
            if (!resolvedEntityType) return { names: [] };
            return client.getEntityNames({ entityType: resolvedEntityType });
          }),
        );

        return {
          names: Array.from(new Set(responses.flatMap(response => response?.names ?? []))).sort(),
        };
      } catch {
        return { names: [] };
      }
    },
    select: data => data?.names ?? [],
    retry: false,
  });
};
