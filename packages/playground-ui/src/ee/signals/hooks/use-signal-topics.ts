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
  const { mastraPlatformApiEndpoint, mastraPlatformObservabilityEndpoint } = useMastraPlatform();
  const endpoint = mastraPlatformObservabilityEndpoint ?? mastraPlatformApiEndpoint;

  return useQuery<EntityLearningTopicsResponse>({
    queryKey: ['entity-learning', 'topics', entityId, signalName, runId],
    enabled: Boolean(endpoint) && Boolean(entityId) && Boolean(signalName) && Boolean(runId),
    retry: false,
    queryFn: () =>
      entityLearningFetch<EntityLearningTopicsResponse>(endpoint!, `/entities/${entityId}/topics`, {
        signalName,
        runId,
      }),
  });
}
