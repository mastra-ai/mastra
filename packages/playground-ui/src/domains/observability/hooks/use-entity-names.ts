import type { EntityType } from '@mastra/core/observability';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { ROOT_ENTITY_TYPE_OPTIONS } from '@/domains/traces/types';

type UseEntityNamesOptions = {
  entityType?: EntityType;
  rootOnly?: boolean;
};

export const useEntityNames = ({ entityType, rootOnly = false }: UseEntityNamesOptions = {}) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-entity-names', rootOnly ? 'root-only' : 'all', entityType ?? 'all-entity-types'],
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
