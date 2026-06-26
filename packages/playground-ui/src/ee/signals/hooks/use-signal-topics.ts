import { useQuery } from '@tanstack/react-query';
import { useMastraPlatform } from '../../../lib/mastra-platform/use-mastra-platform';
import type { EntityLearningTopicsResponse } from '../types';
import { entityLearningFetch } from './entity-learning-fetch';

/**
 * Fetches the topics ("clusters") for a signal run. The `topics` array IS the
 * cluster set — no remapping into fake shapes.
 */
export function useSignalTopics(
  entityId: string | undefined,
  signalName: string | undefined,
  runId: string | undefined,
) {
  const {
    mastraPlatformApiEndpoint,
    mastraPlatformObservabilityEndpoint,
    mastraOrganizationId,
    mastraPlatformProjectId,
  } = useMastraPlatform();
  const endpoint = mastraPlatformObservabilityEndpoint ?? mastraPlatformApiEndpoint;
  const scope = { organizationId: mastraOrganizationId, projectId: mastraPlatformProjectId };

  return useQuery<EntityLearningTopicsResponse>({
    queryKey: ['entity-learning', 'topics', entityId, signalName, runId, mastraOrganizationId, mastraPlatformProjectId],
    enabled: Boolean(endpoint) && Boolean(entityId) && Boolean(signalName) && Boolean(runId),
    retry: false,
    queryFn: () =>
      entityLearningFetch<EntityLearningTopicsResponse>(
        endpoint!,
        `/entities/${entityId}/topics`,
        {
          signalName,
          runId,
        },
        scope,
      ),
  });
}
