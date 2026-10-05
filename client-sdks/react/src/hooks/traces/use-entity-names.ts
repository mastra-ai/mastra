import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { DISCOVERY_STALE_TIME } from './discovery-cache';
import { ROOT_ENTITY_TYPES } from './types';

type EntityTypeValue = `${EntityType}`;

type EntityNamesResponse = Awaited<ReturnType<MastraClient['getEntityNames']>>;

type UseEntityNamesOptions<TData> = {
  entityType?: EntityTypeValue;
  rootOnly?: boolean;
  queryOptions?: MastraQueryOptions<EntityNamesResponse, TData>;
};

function resolveEntityType(entityType: EntityTypeValue) {
  return Object.values(EntityType).find(candidate => candidate === entityType);
}

export const useEntityNames = <TData = EntityNamesResponse['names']>({
  entityType,
  rootOnly = false,
  queryOptions,
}: UseEntityNamesOptions<TData> = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  // Mirror the queryFn branches so the cache key reflects what the server
  // actually returns. rootOnly only matters when entityType is not set; when
  // entityType is set, the query ignores rootOnly entirely.
  const queryKey = entityType
    ? ['observability-entity-names', 'by-type', entityType]
    : ['observability-entity-names', 'all', rootOnly ? 'root-only' : 'all-types'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<EntityNamesResponse> => {
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
          Object.values(ROOT_ENTITY_TYPES).map(rootEntityType => {
            const resolvedEntityType = resolveEntityType(rootEntityType);
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
    select: data => (data?.names ?? []) as TData,
    retry: false,
    staleTime: DISCOVERY_STALE_TIME,
    ...queryOptions,
  });
};
