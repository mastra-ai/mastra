import { useQuery } from '@tanstack/react-query';
import { useMastraPlatform } from '../../../lib/mastra-platform/use-mastra-platform';
import type { EntitiesResponse, EntityLearningEntity } from '../types';
import { entityLearningFetch } from './entity-learning-fetch';

/**
 * Lists the entities that have entity-learning data, including each entity's
 * `availableSignals` and `latestRunId`. Gated on platform availability.
 */
export function useEntities() {
  const {
    mastraPlatformApiEndpoint,
    mastraPlatformObservabilityEndpoint,
    mastraOrganizationId,
    mastraPlatformProjectId,
  } = useMastraPlatform();
  const endpoint = mastraPlatformObservabilityEndpoint ?? mastraPlatformApiEndpoint;
  const scope = { organizationId: mastraOrganizationId, projectId: mastraPlatformProjectId };

  return useQuery<EntityLearningEntity[]>({
    queryKey: ['entity-learning', 'entities', mastraOrganizationId, mastraPlatformProjectId],
    enabled: Boolean(endpoint),
    retry: false,
    queryFn: async () => {
      const { entities } = await entityLearningFetch<EntitiesResponse>(endpoint!, '/entities', undefined, scope);
      return entities;
    },
  });
}

/**
 * Resolves a single entity by id from the entities list.
 */
export function useEntity(entityId: string | undefined) {
  const query = useEntities();

  return {
    ...query,
    data: entityId ? query.data?.find(entity => entity.entityId === entityId) : undefined,
  };
}

/**
 * Resolves the entity that exposes a given signal. The signals UI is keyed by
 * signal name, so this finds the owning entity (and its `latestRunId`).
 */
export function useEntityForSignal(signalName: string | undefined) {
  const query = useEntities();

  return {
    ...query,
    data: signalName ? query.data?.find(entity => entity.availableSignals.includes(signalName)) : undefined,
  };
}
