import type { EntityType } from '@mastra/core/observability';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { ROOT_ENTITY_TYPE_OPTIONS } from '@/domains/traces/trace-filters';

type UseEntityNamesOptions = {
  entityType?: EntityType;
  rootOnly?: boolean;
};

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
          return await client.getEntityNames({ entityType });
        }

        if (!rootOnly) {
          return await client.getEntityNames();
        }

        const responses = await Promise.all(
          ROOT_ENTITY_TYPE_OPTIONS.map(option => client.getEntityNames({ entityType: option.entityType })),
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
